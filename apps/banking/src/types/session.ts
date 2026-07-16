export type SessionStatus =
  | "restoring"
  | "unauthenticated"
  | "authentication-in-progress"
  | "onboarding-required"
  | "active";

export type SessionUser = {
  id: string;
  identifier: string;
};

export type Session = {
  status: SessionStatus;
  user: SessionUser | null;
};
