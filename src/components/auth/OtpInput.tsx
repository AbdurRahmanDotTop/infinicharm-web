'use client';

import React, { useEffect, useRef } from 'react';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  length?: number;
  className?: string;
}

export function OtpInput({
  value = '',
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  hasError = false,
  length = 6,
  className = '',
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Array of single-character strings for each box
  const digits = Array.from({ length }, (_, i) => value[i] || '');
  const currentCharsRef = useRef<string[]>(digits);

  useEffect(() => {
    currentCharsRef.current = Array.from({ length }, (_, i) => value[i] || '');
  }, [value, length]);

  useEffect(() => {
    if (autoFocus && !disabled && inputRefs.current[0]) {
      // Focus first input on mount if value is empty
      if (!value) {
        inputRefs.current[0]?.focus();
      }
    }
  }, [autoFocus, disabled, value]);

  const setDigitAt = (index: number, char: string) => {
    currentCharsRef.current[index] = char;
    const nextVal = currentCharsRef.current.join('').replace(/\D/g, '').slice(0, length);
    onChange(nextVal);
    if (nextVal.length === length && onComplete) {
      onComplete(nextVal);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        setDigitAt(index, '');
      } else if (index > 0) {
        setDigitAt(index - 1, '');
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }

    if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      setDigitAt(index, '');
      return;
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setDigitAt(index, '');
      return;
    }

    // Single digit typed
    const lastChar = rawVal[rawVal.length - 1];
    setDigitAt(index, lastChar);

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    onChange(pasted);
    if (pasted.length === length && onComplete) {
      onComplete(pasted);
    }

    const nextFocusIndex = Math.min(pasted.length, length - 1);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  return (
    <div
      data-testid="otp-input-group"
      className={`flex items-center justify-center gap-2 sm:gap-3 ${className}`}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Verification code digit ${i + 1} of ${length}`}
          data-testid={`otp-box-${i}`}
          value={digits[i] || ''}
          disabled={disabled}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onChange={(e) => handleChange(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={`w-10 h-13 sm:w-12 sm:h-14 text-center font-mono font-bold text-xl sm:text-2xl rounded-xl border bg-surface transition-all select-all outline-none ${
            hasError
              ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
              : digits[i]
                ? 'border-accent bg-accent/5 text-primary focus:border-accent focus:ring-2 focus:ring-accent/20'
                : 'border-border text-primary hover:border-border-hover focus:border-accent focus:ring-2 focus:ring-accent/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-muted/10' : ''}`}
        />
      ))}
    </div>
  );
}

