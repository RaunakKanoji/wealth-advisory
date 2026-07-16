import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import type { PropsWithChildren } from "react";
import { Platform } from "react-native";

import { ConsentServiceError, getConsentErrorMessage } from "@/src/features/consent/models/consent";
import type {
  ConsentCategory,
  ConsentCategoryId,
  ConsentDecision,
  ConsentReceipt,
} from "@/src/features/consent/models/consent";
import { consentService } from "@/src/features/consent/services/consent.service";
import { useSession } from "@/src/providers/SessionProvider";

export type ConsentPhase =
  | "loading"
  | "error"
  | "editing"
  | "reviewing"
  | "submitting"
  | "submitted"
  | "submission-error";

export type ConsentState = {
  phase: ConsentPhase;
  categories: ConsentCategory[];
  policyVersion: string;
  acknowledged: boolean;
  detailsCategoryId: ConsentCategoryId | null;
  receipt: ConsentReceipt | null;
  errorMessage: string | null;
};

type ConsentAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; categories: ConsentCategory[]; policyVersion: string }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "TOGGLE_CATEGORY"; categoryId: ConsentCategoryId }
  | { type: "OPEN_DETAILS"; categoryId: ConsentCategoryId }
  | { type: "CLOSE_DETAILS" }
  | { type: "GO_TO_REVIEW" }
  | { type: "GO_TO_EDIT" }
  | { type: "SET_ACKNOWLEDGED"; acknowledged: boolean }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; receipt: ConsentReceipt }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "RETRY" };

const initialState: ConsentState = {
  phase: "loading",
  categories: [],
  policyVersion: "",
  acknowledged: false,
  detailsCategoryId: null,
  receipt: null,
  errorMessage: null,
};

function consentReducer(state: ConsentState, action: ConsentAction): ConsentState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, phase: "loading", errorMessage: null };
    case "LOAD_SUCCESS":
      return {
        ...state,
        phase: "editing",
        categories: action.categories,
        policyVersion: action.policyVersion,
        errorMessage: null,
      };
    case "LOAD_ERROR":
      return { ...state, phase: "error", errorMessage: action.message };
    case "TOGGLE_CATEGORY":
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.categoryId && !category.required
            ? { ...category, selected: !category.selected }
            : category,
        ),
      };
    case "OPEN_DETAILS":
      return { ...state, detailsCategoryId: action.categoryId };
    case "CLOSE_DETAILS":
      return { ...state, detailsCategoryId: null };
    case "GO_TO_REVIEW":
      return { ...state, phase: "reviewing" };
    case "GO_TO_EDIT":
      return { ...state, phase: "editing", acknowledged: false };
    case "SET_ACKNOWLEDGED":
      return { ...state, acknowledged: action.acknowledged };
    case "SUBMIT_START":
      return { ...state, phase: "submitting", errorMessage: null };
    case "SUBMIT_SUCCESS":
      return { ...state, phase: "submitted", receipt: action.receipt };
    case "SUBMIT_ERROR":
      return { ...state, phase: "submission-error", errorMessage: action.message };
    case "RETRY":
      return { ...state, phase: "reviewing", errorMessage: null };
    default:
      return state;
  }
}

type ConsentContextValue = {
  state: ConsentState;
  toggleCategory: (categoryId: ConsentCategoryId) => void;
  openDetails: (categoryId: ConsentCategoryId) => void;
  closeDetails: () => void;
  goToReview: () => void;
  goToEdit: () => void;
  setAcknowledged: (acknowledged: boolean) => void;
  submit: () => Promise<void>;
  retry: () => void;
  reload: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

// Session-scoped only: state lives in memory for the lifetime of the
// onboarding route group (mounted once in app/(onboarding)/_layout.tsx) and
// is discarded on unmount — no unencrypted persistence of consent
// selections or decisions.
export function ConsentProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(consentReducer, initialState);
  const { user } = useSession();

  const reload = useCallback(() => {
    dispatch({ type: "LOAD_START" });
    consentService
      .getConsentConfiguration()
      .then((configuration) => {
        dispatch({
          type: "LOAD_SUCCESS",
          categories: [...configuration.categories],
          policyVersion: configuration.policyVersion,
        });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ConsentServiceError
            ? getConsentErrorMessage(error.code)
            : getConsentErrorMessage("network-error");
        dispatch({ type: "LOAD_ERROR", message });
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleCategory = useCallback((categoryId: ConsentCategoryId) => {
    dispatch({ type: "TOGGLE_CATEGORY", categoryId });
  }, []);

  const openDetails = useCallback((categoryId: ConsentCategoryId) => {
    dispatch({ type: "OPEN_DETAILS", categoryId });
  }, []);

  const closeDetails = useCallback(() => dispatch({ type: "CLOSE_DETAILS" }), []);
  const goToReview = useCallback(() => dispatch({ type: "GO_TO_REVIEW" }), []);
  const goToEdit = useCallback(() => dispatch({ type: "GO_TO_EDIT" }), []);
  const setAcknowledged = useCallback(
    (acknowledged: boolean) => dispatch({ type: "SET_ACKNOWLEDGED", acknowledged }),
    [],
  );
  const retry = useCallback(() => dispatch({ type: "RETRY" }), []);

  const submit = useCallback(async () => {
    // Enforced here too, not just via the review screen's disabled submit
    // button — the acknowledgement requirement must hold regardless of how
    // submit() gets called.
    if (!state.acknowledged) {
      dispatch({
        type: "SUBMIT_ERROR",
        message: "Please confirm you've reviewed your permissions before submitting.",
      });
      return;
    }

    dispatch({ type: "SUBMIT_START" });
    try {
      const decidedAt = new Date().toISOString();
      const decisions: ConsentDecision[] = state.categories.map((category) => ({
        categoryId: category.id,
        decision: category.selected ? "granted" : "declined",
        required: category.required,
        policyVersion: category.policyVersion,
        decidedAt,
      }));

      const receipt = await consentService.submitConsent({
        customerId: user?.id ?? "unknown",
        decisions,
        policyVersion: state.policyVersion,
        channel: Platform.OS === "web" ? "web" : "mobile",
        acknowledgedAt: decidedAt,
      });

      dispatch({ type: "SUBMIT_SUCCESS", receipt });
    } catch (error) {
      const message =
        error instanceof ConsentServiceError
          ? getConsentErrorMessage(error.code)
          : getConsentErrorMessage("network-error");
      dispatch({ type: "SUBMIT_ERROR", message });
    }
  }, [state.categories, state.policyVersion, state.acknowledged, user]);

  const value = useMemo(
    () => ({
      state,
      toggleCategory,
      openDetails,
      closeDetails,
      goToReview,
      goToEdit,
      setAcknowledged,
      submit,
      retry,
      reload,
    }),
    [state, toggleCategory, openDetails, closeDetails, goToReview, goToEdit, setAcknowledged, submit, retry, reload],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsentContext() {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error("useConsentContext must be used within a ConsentProvider");
  }
  return context;
}
