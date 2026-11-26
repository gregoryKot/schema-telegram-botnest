-- CreateTable
CREATE TABLE "ClientMeeting" (
    "clientKey" TEXT NOT NULL,
    "meetingUrl" TEXT NOT NULL,
    "zoomMeetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMeeting_pkey" PRIMARY KEY ("clientKey")
);
