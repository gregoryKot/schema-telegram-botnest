// Сборка ответов админской аналитики из запросов и чистых сборщиков.
import { Injectable } from '@nestjs/common';
import { localDate } from '../../utils/tz';
import type {
  AdminAnalyticsDays,
  AdminOverview,
  AdminPersonRow,
  AdminTherapistRow,
} from './admin-analytics.types';
import { AdminAnalyticsQueries, windowStart } from './admin-analytics.queries';
import {
  REPORT_TZ,
  bucketByDay,
  buildDaily,
  buildFeatures,
  windowDates,
} from './admin-overview.builders';
import { buildPeopleRows, topPeople } from './admin-people.builders';
import { buildTherapistRows } from './admin-therapist.builders';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly q: AdminAnalyticsQueries) {}

  private window(days: number) {
    const today = localDate(REPORT_TZ);
    const dates = windowDates(days, today);
    return { today, dates, since: windowStart(dates[0]) };
  }

  async overview(days: AdminAnalyticsDays): Promise<AdminOverview> {
    const { today, dates, since } = this.window(days);
    const [active, newMoments, events, byNameUser, totals, a1, a7, a30] =
      await Promise.all([
        this.q.activePerDay(dates[0], today),
        this.q.newUserMoments(since),
        this.q.eventsPerDay(since),
        this.q.eventsByNameUser(since),
        this.q.totals(),
        this.q.distinctActiveSince(today),
        this.q.distinctActiveSince(windowDates(7, today)[0]),
        this.q.distinctActiveSince(windowDates(30, today)[0]),
      ]);
    return {
      days,
      totals: {
        ...totals,
        activeToday: a1,
        active7: a7,
        active30: a30,
        newInPeriod: newMoments.length,
      },
      daily: buildDaily(dates, {
        active,
        newUsers: bucketByDay(dates, newMoments),
        events,
      }),
      features: buildFeatures(byNameUser),
    };
  }

  async therapists(days: AdminAnalyticsDays): Promise<AdminTherapistRow[]> {
    const { dates, since } = this.window(days);
    const therapists = await this.q.therapists();
    const ids = therapists.map((t) => t.id);
    if (ids.length === 0) return [];
    const [relations, actions, activity] = await Promise.all([
      this.q.relations(ids),
      this.q.actions(ids, since),
      this.q.activityOf(ids, dates[0]),
    ]);
    return buildTherapistRows({
      dates,
      therapists,
      relations,
      actions,
      activity,
    });
  }

  async people(days: AdminAnalyticsDays): Promise<AdminPersonRow[]> {
    const { dates, since } = this.window(days);
    const top = topPeople(await this.q.eventsByNameUser(since));
    const info = await this.q.peopleInfo(
      top.map((p) => p.userId),
      dates[0],
    );
    return buildPeopleRows(top, info);
  }
}
