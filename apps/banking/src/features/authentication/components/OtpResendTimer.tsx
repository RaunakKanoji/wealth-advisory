import { useEffect, useState } from "react";

import { useAccessibilityAnnouncement } from "@/src/components/feedback/useAccessibilityAnnouncement";
import { Button } from "@/src/components/ui/Button";

type OtpResendTimerProps = {
  /** ISO timestamp from the active challenge; countdown resets when it changes. */
  resendAvailableAt: string;
  onResend: () => void;
  isResending: boolean;
  disabled?: boolean;
};

// Resend control with its own countdown. The interval is cleaned up on
// unmount and re-armed whenever a successful resend delivers a new
// resendAvailableAt. Availability is announced to screen readers once per
// countdown, not once per tick.
export function OtpResendTimer({
  resendAvailableAt,
  onResend,
  isResending,
  disabled = false,
}: OtpResendTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  const availableAtMs = new Date(resendAvailableAt).getTime();
  const secondsRemaining = Math.max(0, Math.ceil((availableAtMs - now) / 1000));
  const canResend = secondsRemaining === 0 && !isResending && !disabled;

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [resendAvailableAt]);

  useAccessibilityAnnouncement(
    secondsRemaining === 0 && !disabled ? "You can request a new code now." : null,
  );

  return (
    <Button
      label={canResend || isResending ? "Resend code" : `Resend code in ${secondsRemaining}s`}
      variant="secondary"
      disabled={!canResend && !isResending}
      loading={isResending}
      onPress={onResend}
      accessibilityHint={
        canResend
          ? "Sends a new verification code to your registered mobile number"
          : `A new code can be requested in ${secondsRemaining} seconds`
      }
    />
  );
}
