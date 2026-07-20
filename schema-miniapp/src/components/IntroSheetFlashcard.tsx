import { useEffect, useRef } from 'react';
import { pressable } from '../utils/a11y';
import { CrisisGate } from './CrisisGate';

export interface IntroSheetQuestion<T extends Record<string, string>> {
  key: keyof T;
  label: string;
  hint: string;
  placeholder: string;
  optional?: boolean;
}

interface Props<T extends Record<string, string>> {
  accentColor: string;
  step: number;
  totalSteps: number;
  question: IntroSheetQuestion<T>;
  answer: string;
  flipped: boolean;
  onFlip: () => void;
  onUnflip: () => void;
  onChange: (value: string) => void;
  answerPromptText: string;
}

// Флэшкарта вопроса интро-шита (вынесена из ModeIntroSheet/SchemaIntroSheet,
// правило №11 CLAUDE.md — были продублированы почти дословно).
export function IntroSheetFlashcard<T extends Record<string, string>>({
  accentColor,
  step,
  totalSteps,
  question,
  answer,
  flipped,
  onFlip,
  onUnflip,
  onChange,
  answerPromptText,
}: Props<T>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (flipped) textareaRef.current?.focus();
  }, [flipped]);
  return (
    <div
      {...pressable(() => {
        if (!flipped) onFlip();
      })}
      style={{
        background: flipped ? `${accentColor}06` : 'var(--surface)',
        border: `1px solid ${flipped ? `${accentColor}40` : 'var(--border-color)'}`,
        borderRadius: 20,
        padding: '18px 18px 14px',
        marginBottom: 16,
        minHeight: 120,
        cursor: flipped ? 'default' : 'pointer',
        position: 'relative',
        transition: 'all 0.2s',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: accentColor,
          }}
        >
          {step + 1} / {totalSteps}
          {question.optional && (
            <span
              style={{
                fontWeight: 400,
                color: 'var(--text-faint)',
                marginLeft: 6,
              }}
            >
              необязательно
            </span>
          )}
        </div>
        {flipped && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnflip();
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 11,
              color: 'var(--text-faint)',
              cursor: 'pointer',
            }}
          >
            ← к вопросу
          </button>
        )}
      </div>

      {!flipped ? (
        <>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1.35,
              marginBottom: 8,
            }}
          >
            {question.label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-faint)',
              lineHeight: 1.5,
              marginBottom: 14,
            }}
          >
            {question.hint}
          </div>
          {answer.trim() ? (
            <div
              style={{
                background: 'var(--surface-2)',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {answer}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 14px',
                borderRadius: 12,
                background: `${accentColor}10`,
                border: `1px dashed ${accentColor}55`,
                fontSize: 13,
                color: accentColor,
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 16 }}>✏️</span>
              <span>{answerPromptText}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.4,
              marginBottom: 10,
            }}
          >
            {question.label}
          </div>
          <textarea
            ref={textareaRef}
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder}
            rows={4}
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: `1.5px solid ${answer.trim() ? `${accentColor}66` : 'var(--border-color)'}`,
              borderRadius: 12,
              padding: '11px 13px',
              color: 'var(--text)',
              fontSize: 14,
              lineHeight: 1.55,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
          />
          <CrisisGate texts={[answer]} surface="flashcard" />
        </>
      )}
    </div>
  );
}
