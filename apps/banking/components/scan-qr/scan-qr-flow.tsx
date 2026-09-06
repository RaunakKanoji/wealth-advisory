import Ionicons from "@expo/vector-icons/Ionicons";
import { Camera, type BarcodeScanningResult, type CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ScannerViewport } from "@/components/scan-qr/scanner-viewport";
import { DEMO_CUSTOMER_A } from "@/data/accounts-demo-data";
import {
  createManualPaymentQr,
  parseAmountToMinorUnits,
  parsePaymentQr,
  type ParsedPaymentQr,
  PaymentQrParseError,
} from "@/lib/payment-qr-parser";
import { formatIndianMinorUnits } from "@/lib/currency";
import {
  getAccountPreference,
} from "@/services/accounts-service";
import {
  getEligibleFundingAccounts,
  preparePaymentDraft,
  checkDemoPaymentStatus,
  executeDemoPayment,
} from "@/services/payment-service";
import { createTransferQrIntake } from "@/services/transfer-service";
import type { BankAccount } from "@/types/banking";
import type { PaymentAttempt, PaymentDraft, PaymentInputMethod } from "@/types/payments";
import { useUser } from "@clerk/expo";

type FlowStage = "scan" | "manual" | "review" | "result";
type ScannerState =
  | "permission-required"
  | "requesting-permission"
  | "starting-camera"
  | "scanning"
  | "processing-image"
  | "validating-qr"
  | "paused"
  | "error"
  | "image-candidates";

type ImageCandidate = {
  id: string;
  data: string;
};

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 6000;
const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#14201D",
  secondary: "#687386",
  muted: "#8B96A5",
  border: "#E5E9EC",
  green: "#007E5D",
  greenDark: "#006A4E",
  greenSoft: "#E6F3EF",
  orange: "#F45B2A",
  orangeSoft: "#FFF0EA",
  danger: "#B42318",
  dangerSoft: "#FEF3F2",
} as const;

function createClientKey() {
  const randomUuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (typeof randomUuid === "function") {
    return `demo-confirm-${randomUuid()}`;
  }
  return `demo-confirm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function accountBalance(account: BankAccount) {
  return account.availableBalanceMinorUnits ?? account.balanceMinorUnits;
}

function statusForScanner(state: ScannerState) {
  switch (state) {
    case "starting-camera":
      return "Starting camera…";
    case "validating-qr":
      return "QR detected. Checking details…";
    default:
      return "Position the QR inside the frame.";
  }
}

function readableError(error: unknown) {
  if (error instanceof PaymentQrParseError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "We could not process that QR. Try another image or enter the UPI ID manually.";
}

export function ScanQrFlow() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useUser();
  const { width } = useWindowDimensions();
  const customerId = user?.id ?? DEMO_CUSTOMER_A;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [stage, setStage] = useState<FlowStage>("scan");
  const [scannerState, setScannerState] = useState<ScannerState>("permission-required");
  const [cameraActive, setCameraActive] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[]>([]);
  const [manualUpiId, setManualUpiId] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [eligibleAccounts, setEligibleAccounts] = useState<BankAccount[]>([]);
  const [balanceVisibility, setBalanceVisibility] = useState<Record<string, boolean>>({});
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [transferIntakeId, setTransferIntakeId] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(createClientKey);

  const detectionLock = useRef(false);
  const processingImage = useRef(false);
  const confirmationLock = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(isFocused);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageJobId = useRef(0);

  useEffect(() => {
    focused.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    return () => {
      mounted.current = false;
      if (switchTimer.current) clearTimeout(switchTimer.current);
      // CameraView is conditionally unmounted whenever cameraActive becomes
      // false, which releases its media tracks and decoder loop.
    };
  }, []);

  useEffect(() => {
    if (!isFocused && cameraActive) {
      setCameraActive(false);
      setScannerState("paused");
    }
  }, [cameraActive, isFocused]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && cameraActive && stage === "scan") {
        setCameraActive(false);
        setScannerState("paused");
      }
    });
    return () => subscription.remove();
  }, [cameraActive, stage]);

  const goBackSafely = useCallback(() => {
    setCameraActive(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)");
    }
  }, [router]);

  const resetForScanner = useCallback(() => {
    imageJobId.current += 1;
    detectionLock.current = false;
    processingImage.current = false;
    confirmationLock.current = false;
    setCameraActive(false);
    setStage("scan");
    setScannerState("permission-required");
    setScanError(null);
    setImageCandidates([]);
    setImageUri(null);
    setDraft(null);
    setEligibleAccounts([]);
    setSelectedAccountId("");
    setReviewError(null);
    setResultMessage(null);
    setAttempt(null);
    setTransferIntakeId(null);
    setAmountInput("");
    setIdempotencyKey(createClientKey());
  }, []);

  const loadAccountsForReview = useCallback(async () => {
    const accounts = await getEligibleFundingAccounts(customerId);
    const preferences = await Promise.all(
      accounts.map(async (account) => {
        try {
          const preference = await getAccountPreference(account.id, { customerId });
          return [account.id, preference.balanceVisible !== false] as const;
        } catch {
          return [account.id, true] as const;
        }
      }),
    );
    if (!mounted.current) return accounts;
    setEligibleAccounts(accounts);
    setBalanceVisibility(Object.fromEntries(preferences));
    return accounts;
  }, [customerId]);

  const openReview = useCallback(async (
    parsed: ParsedPaymentQr,
    inputMethod: PaymentInputMethod,
  ) => {
    setCameraActive(false);
    setScannerState("validating-qr");
    try {
      const [nextDraft, accounts, intake] = await Promise.all([
        preparePaymentDraft(parsed, inputMethod, { customerId }),
        loadAccountsForReview(),
        createTransferQrIntake(parsed, { customerId }),
      ]);
      if (!mounted.current) return;
      setDraft(nextDraft);
      setSelectedAccountId(nextDraft.fundingAccountId ?? accounts[0]?.id ?? "");
      setAmountInput(parsed.amountMinorUnits === null ? "" : (parsed.amountMinorUnits / 100).toFixed(2));
      setTransferIntakeId(intake.id);
      setReviewError(null);
      setStage("review");
    } catch (error) {
      if (!mounted.current) return;
      setScanError(readableError(error));
      setScannerState("error");
      detectionLock.current = false;
    }
  }, [customerId, loadAccountsForReview]);

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (detectionLock.current || !result.data) return;
    detectionLock.current = true;
    setScanError(null);
    try {
      void openReview(parsePaymentQr(result.data), "camera");
    } catch (error) {
      setScanError(readableError(error));
      setScannerState("error");
      detectionLock.current = false;
    }
  }, [openReview]);

  const refreshCameraCapabilities = useCallback(async () => {
    if (Platform.OS !== "web") {
      // Expo Camera supports front/back facing on native platforms. A device
      // with only one usable camera will simply keep the current facing.
      setHasMultipleCameras(true);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setHasMultipleCameras(false);
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (mounted.current) {
        setHasMultipleCameras(devices.filter((device) => device.kind === "videoinput").length > 1);
      }
    } catch {
      setHasMultipleCameras(false);
    }
  }, []);

  const handleCameraReady = useCallback(() => {
    if (!mounted.current) return;
    setScannerState("scanning");
    void refreshCameraCapabilities();
  }, [refreshCameraCapabilities]);

  const handleMountError = useCallback((message: string) => {
    if (!mounted.current) return;
    setCameraActive(false);
    setScannerState("error");
    setScanError(/permission|denied|not allowed/i.test(message)
      ? "Camera access is blocked. You can allow it in your browser or device settings, or use another method."
      : /not found|no camera|unavailable|busy/i.test(message)
        ? "No usable camera is available right now. Try uploading a QR image or enter the UPI ID manually."
        : "The camera could not start. Try again or use another method.");
  }, []);

  const handleEnableCamera = useCallback(async () => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.isSecureContext) {
        setScannerState("error");
        setScanError("Camera access needs a secure browser context. Open the app over HTTPS or use another method.");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setScannerState("error");
        setScanError("This browser does not support camera access. Open the app in a supported browser or use another method.");
        return;
      }
    }

    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain === false) {
      setScannerState("error");
      setScanError("Camera access is blocked in your browser or device settings. Enable it there, or choose Upload QR or Enter UPI ID.");
      return;
    }

    setScannerState("requesting-permission");
    setScanError(null);
    try {
      const response = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!mounted.current || !focused.current) return;
      if (!response.granted && response.canAskAgain === false) {
        setScannerState("error");
        setScanError("Camera access is blocked in your browser or device settings. Enable it there, or choose Upload QR or Enter UPI ID.");
        return;
      }
      if (!response.granted) {
        setScannerState("error");
        setScanError(response.canAskAgain
          ? "Camera access was not granted. You can try again or choose Upload QR or Enter UPI ID."
          : "Camera access is blocked in your browser or device settings. Enable it there, or choose Upload QR or Enter UPI ID.");
        return;
      }
      setScannerState("starting-camera");
      setCameraActive(true);
    } catch {
      if (!mounted.current) return;
      setScannerState("error");
      setScanError("Camera access could not be started. Try again or choose another method.");
    }
  }, [cameraPermission, requestCameraPermission]);

  const handleResumeCamera = useCallback(() => {
    setScanError(null);
    setScannerState("starting-camera");
    setCameraActive(true);
  }, []);

  const handleSwitchCamera = useCallback(() => {
    if (!cameraActive) return;
    setCameraActive(false);
    setScannerState("starting-camera");
    setFacing((current) => (current === "back" ? "front" : "back"));
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => {
      if (mounted.current && isFocused && stage === "scan") {
        setCameraActive(true);
      }
    }, 80);
  }, [cameraActive, isFocused, stage]);

  const handleUpload = useCallback(async () => {
    if (processingImage.current) return;
    const currentJobId = imageJobId.current + 1;
    imageJobId.current = currentJobId;
    processingImage.current = true;
    setCameraActive(false);
    setScannerState("processing-image");
    setScanError(null);
    setImageCandidates([]);

    try {
      // ImagePicker opens the platform picker directly. It does not request
      // camera access, so this alternative remains available after denial.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 1,
        selectionLimit: 1,
      });
      if (!mounted.current || imageJobId.current !== currentJobId) return;
      if (result.canceled) {
        setScannerState("permission-required");
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) throw new Error("The selected image could not be read");
      if (asset.fileSize !== undefined && asset.fileSize > MAX_IMAGE_BYTES) {
        throw new Error("Choose an image smaller than 12 MB");
      }
      if (asset.width > MAX_IMAGE_DIMENSION || asset.height > MAX_IMAGE_DIMENSION) {
        throw new Error("Choose an image no larger than 6000 × 6000 pixels");
      }
      if (asset.mimeType && !["image/png", "image/jpeg", "image/jpg"].includes(asset.mimeType)) {
        throw new Error("Choose a PNG or JPEG image");
      }

      setImageUri(asset.uri);
      const results = await Camera.scanFromURLAsync(asset.uri, ["qr"]);
      if (!mounted.current || imageJobId.current !== currentJobId) return;
      const candidates = results.filter((item) => Boolean(item.data)).map((item, index) => ({
        id: `image-candidate-${index}`,
        data: item.data,
      }));
      if (candidates.length === 0) {
        throw new Error("We could not find a readable QR in that image. Try better lighting or crop closer to one code.");
      }
      detectionLock.current = true;
      if (candidates.length > 1) {
        setImageCandidates(candidates);
        setScannerState("image-candidates");
      } else {
        await openReview(parsePaymentQr(candidates[0].data), "upload");
      }
    } catch (error) {
      if (mounted.current && imageJobId.current === currentJobId) {
        setScanError(readableError(error));
        setScannerState("error");
        detectionLock.current = false;
      }
    } finally {
      if (imageJobId.current === currentJobId) processingImage.current = false;
    }
  }, [openReview]);

  const handleManualContinue = useCallback(async () => {
    setManualError(null);
    try {
      const parsed = createManualPaymentQr(manualUpiId, manualLabel);
      detectionLock.current = true;
      await openReview(parsed, "manual");
    } catch (error) {
      setManualError(readableError(error));
      detectionLock.current = false;
    }
  }, [manualLabel, manualUpiId, openReview]);

  const handleImageCandidate = useCallback((candidateId: string) => {
    const selected = imageCandidates.find((item) => item.id === candidateId);
    if (!selected) return;

    try {
      void openReview(parsePaymentQr(selected.data), "upload");
    } catch (error) {
      setScanError(readableError(error));
      setScannerState("error");
      detectionLock.current = false;
    }
  }, [imageCandidates, openReview]);

  const handleAmountChange = useCallback((value: string) => {
    setAmountInput(value.replace(/[^0-9.]/g, ""));
    setReviewError(null);
    setIdempotencyKey(createClientKey());
  }, []);

  const handleAccountSelect = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    setReviewError(null);
    setIdempotencyKey(createClientKey());
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!draft || confirmationLock.current || isSubmitting) return;
    confirmationLock.current = true;
    setIsSubmitting(true);
    setReviewError(null);
    try {
      const amountMinorUnits = draft.amountSource === "from-qr"
        ? draft.amountMinorUnits
        : parseAmountToMinorUnits(amountInput);
      const nextAttempt = await executeDemoPayment({
        draft,
        amountMinorUnits,
        fundingAccountId: selectedAccountId,
        idempotencyKey,
        customerId,
      });
      if (!mounted.current) return;
      setAttempt(nextAttempt);
      setStage("result");
      setCameraActive(false);
    } catch (error) {
      if (mounted.current) setReviewError(readableError(error));
      confirmationLock.current = false;
    } finally {
      if (mounted.current) setIsSubmitting(false);
    }
  }, [amountInput, customerId, draft, idempotencyKey, isSubmitting, selectedAccountId]);

  const handleCheckStatus = useCallback(async () => {
    if (!attempt || isCheckingStatus) return;
    setIsCheckingStatus(true);
    setResultMessage(null);
    try {
      const currentAttempt = await checkDemoPaymentStatus(attempt.id, customerId);
      setAttempt(currentAttempt);
      setResultMessage(currentAttempt.status === "pending"
        ? "This demo attempt is still pending. No new payment was created."
        : `The demo attempt is ${currentAttempt.status}.`);
    } catch (error) {
      setResultMessage(readableError(error));
    } finally {
      setIsCheckingStatus(false);
    }
  }, [attempt, customerId, isCheckingStatus]);

  const showCamera = stage === "scan" && cameraActive && isFocused;
  const contentWidth = width >= 768 ? 720 : undefined;

  return (
    <ScreenContainer edges={["top", "bottom"]} backgroundColor={colors.background}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { maxWidth: contentWidth }]}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={stage === "scan" ? "Close QR scanner" : "Back from QR payment flow"}
              hitSlop={8}
              onPress={stage === "scan" ? goBackSafely : resetForScanner}
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={23} color={colors.text} />
              <Text style={styles.headerActionText}>Back</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.headerTitle}>Scan QR</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="QR scanner help"
              onPress={() => setHelpOpen((current) => !current)}
              style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}
            >
              <Text style={styles.helpText}>Help</Text>
            </Pressable>
          </View>

          {helpOpen ? (
            <View style={styles.helpCard} accessibilityLiveRegion="polite">
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.green} />
              <Text style={styles.helpCardText}>
                Check the recipient and amount carefully. QR text is not proof that a recipient is verified.
              </Text>
            </View>
          ) : null}

          {stage === "scan" ? (
            <ScanStage
              scannerState={scannerState}
              scanError={scanError}
              cameraPermission={cameraPermission}
              showCamera={showCamera}
              facing={facing}
              hasMultipleCameras={hasMultipleCameras}
              imageUri={imageUri}
              imageCandidates={imageCandidates}
              onEnableCamera={() => void handleEnableCamera()}
              onResumeCamera={handleResumeCamera}
              onSwitchCamera={handleSwitchCamera}
              onBarcodeScanned={handleBarcodeScanned}
              onCameraReady={handleCameraReady}
              onMountError={handleMountError}
              onUpload={() => void handleUpload()}
              onManual={() => {
                imageJobId.current += 1;
                processingImage.current = false;
                setCameraActive(false);
                setStage("manual");
                setScannerState("permission-required");
                setManualError(null);
              }}
              onTryAgain={() => {
                setScanError(null);
                setImageCandidates([]);
                setImageUri(null);
                detectionLock.current = false;
                setScannerState("permission-required");
              }}
              onChooseCandidate={handleImageCandidate}
            />
          ) : null}

          {stage === "manual" ? (
            <ManualStage
              upiId={manualUpiId}
              label={manualLabel}
              error={manualError}
              onChangeUpiId={setManualUpiId}
              onChangeLabel={setManualLabel}
              onContinue={() => void handleManualContinue()}
              onCancel={resetForScanner}
            />
          ) : null}

          {stage === "review" && draft ? (
            <ReviewStage
              draft={draft}
              amountInput={amountInput}
              accounts={eligibleAccounts}
              selectedAccountId={selectedAccountId}
              balanceVisibility={balanceVisibility}
              error={reviewError}
              isSubmitting={isSubmitting}
              onAmountChange={handleAmountChange}
              onAccountSelect={handleAccountSelect}
              onConfirm={() => void handleConfirm()}
              onContinueInTransfers={() => router.push({ pathname: "/(app)/transfers/new", params: { type: "upi", qrIntakeId: transferIntakeId ?? "" } })}
              onScanAnother={resetForScanner}
            />
          ) : null}

          {stage === "result" && attempt ? (
            <ResultStage
              attempt={attempt}
              resultMessage={resultMessage}
              isCheckingStatus={isCheckingStatus}
              onCheckStatus={() => void handleCheckStatus()}
              onHome={goBackSafely}
              onScanAnother={resetForScanner}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

type ScanStageProps = {
  scannerState: ScannerState;
  scanError: string | null;
  cameraPermission: ReturnType<typeof useCameraPermissions>[0];
  showCamera: boolean;
  facing: CameraType;
  hasMultipleCameras: boolean;
  imageUri: string | null;
  imageCandidates: ImageCandidate[];
  onEnableCamera: () => void;
  onResumeCamera: () => void;
  onSwitchCamera: () => void;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onCameraReady: () => void;
  onMountError: (message: string) => void;
  onUpload: () => void;
  onManual: () => void;
  onTryAgain: () => void;
  onChooseCandidate: (id: string) => void;
};

function ScanStage({
  scannerState,
  scanError,
  cameraPermission,
  showCamera,
  facing,
  hasMultipleCameras,
  imageUri,
  imageCandidates,
  onEnableCamera,
  onResumeCamera,
  onSwitchCamera,
  onBarcodeScanned,
  onCameraReady,
  onMountError,
  onUpload,
  onManual,
  onTryAgain,
  onChooseCandidate,
}: ScanStageProps) {
  const permissionLoading = cameraPermission === null;
  const showError = scannerState === "error" || scannerState === "paused";

  return (
    <View>
      <Text style={styles.introTitle}>Scan a UPI QR to review payment details.</Text>
      <Text style={styles.introDescription}>No payment is made until you confirm.</Text>

      <View style={styles.demoBanner}>
        <Ionicons name="information-circle-outline" size={20} color={colors.orange} />
        <Text style={styles.demoBannerText}>Demo mode — no money will be transferred.</Text>
      </View>

      {showCamera ? (
        <View>
          <ScannerViewport
            facing={facing}
            statusLabel={statusForScanner(scannerState)}
            onBarcodeScanned={onBarcodeScanned}
            onCameraReady={onCameraReady}
            onMountError={onMountError}
          />
          <View style={styles.cameraControls}>
            <Text style={styles.cameraHint}>QR codes are checked only inside the frame when bounds are available.</Text>
            {hasMultipleCameras ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Switch camera"
                onPress={onSwitchCamera}
                style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}
              >
                <Ionicons name="camera-reverse-outline" size={20} color={colors.greenDark} />
                <Text style={styles.controlButtonText}>Switch camera</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.cameraMessageCard, showError && styles.cameraMessageCardError]}>
          <View style={styles.cameraMessageIcon}>
            <Ionicons
              name={scannerState === "paused" ? "pause-circle-outline" : "camera-outline"}
              size={30}
              color={showError ? colors.orange : colors.green}
            />
          </View>
          <Text style={styles.cameraMessageTitle}>
            {permissionLoading
              ? "Checking camera access…"
              : scannerState === "requesting-permission"
                ? "Requesting camera access…"
                : scannerState === "processing-image"
                  ? "Reading your image…"
                  : scannerState === "validating-qr"
                    ? "QR detected. Checking details…"
                  : scannerState === "image-candidates"
                    ? "Choose a QR to review"
                    : scannerState === "paused"
                      ? "Camera paused"
                      : showError
                        ? "We could not start the camera"
                        : "Enable camera to scan"}
          </Text>
          <Text style={styles.cameraMessageBody}>
            {scanError
              ?? (scannerState === "validating-qr"
                ? "The camera is paused while we validate this payment request."
                : scannerState === "paused"
                ? "The camera stopped when the app was backgrounded. Resume only when you are ready."
                : "Camera access is used to scan QR codes. You can upload an image or enter a UPI ID instead.")}
          </Text>
          {!permissionLoading && scannerState === "paused" ? (
            <PrimaryButton label="Resume scanning" onPress={onResumeCamera} />
          ) : !permissionLoading
            && scannerState !== "processing-image"
            && scannerState !== "image-candidates"
            && scannerState !== "validating-qr" ? (
            <PrimaryButton
              label={cameraPermission?.granted ? "Start camera" : "Enable camera"}
              onPress={onEnableCamera}
              disabled={scannerState === "requesting-permission"}
              loading={scannerState === "requesting-permission"}
            />
          ) : null}
          {showError ? (
            <SecondaryButton label="Try again" onPress={onTryAgain} />
          ) : null}
        </View>
      )}

      {imageUri ? (
        <View style={styles.imagePreviewCard}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          <View style={styles.imagePreviewCopy}>
            <Text style={styles.imagePreviewTitle}>Selected QR image</Text>
            <Text style={styles.imagePreviewBody}>The image was processed locally on this device.</Text>
          </View>
        </View>
      ) : null}

      {imageCandidates.length > 1 ? (
        <View style={styles.candidateCard}>
          <Text style={styles.sectionTitle}>More than one QR was found</Text>
          <Text style={styles.sectionDescription}>Choose the code you want to review.</Text>
          {imageCandidates.map((candidate, index) => (
            <Pressable
              key={candidate.id}
              accessibilityRole="button"
              accessibilityLabel={`Choose QR code ${index + 1}`}
              onPress={() => onChooseCandidate(candidate.id)}
              style={({ pressed }) => [styles.candidateButton, pressed && styles.pressed]}
            >
              <Text style={styles.candidateButtonText}>Review QR code {index + 1}</Text>
              <Ionicons name="chevron-forward" size={19} color={colors.greenDark} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.alternativeSection}>
        <Text style={styles.alternativeTitle}>Other ways to continue</Text>
        <View style={styles.alternativeRow}>
          <AlternativeButton icon="image-outline" label="Upload QR" onPress={onUpload} />
          <AlternativeButton icon="create-outline" label="Enter UPI ID" onPress={onManual} />
        </View>
      </View>

      <View style={styles.safetyNote}>
        <Ionicons name="shield-checkmark-outline" size={19} color={colors.green} />
        <Text style={styles.safetyText}>Confirm the recipient and amount before any payment action.</Text>
      </View>
    </View>
  );
}

type ManualStageProps = {
  upiId: string;
  label: string;
  error: string | null;
  onChangeUpiId: (value: string) => void;
  onChangeLabel: (value: string) => void;
  onContinue: () => void;
  onCancel: () => void;
};

function ManualStage({
  upiId,
  label,
  error,
  onChangeUpiId,
  onChangeLabel,
  onContinue,
  onCancel,
}: ManualStageProps) {
  return (
    <View>
      <Text style={styles.introTitle}>Enter a UPI ID to review payment details.</Text>
      <Text style={styles.introDescription}>The recipient is not verified just because the format is valid.</Text>
      <View style={styles.formCard}>
        <FieldLabel label="UPI ID" />
        <TextInput
          testID="manual-upi-id"
          accessibilityLabel="UPI ID"
          value={upiId}
          onChangeText={onChangeUpiId}
          placeholder="name@bank"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="email-address"
          maxLength={320}
          style={styles.textInput}
        />
        <FieldLabel label="Recipient label (optional)" />
        <TextInput
          testID="manual-recipient-label"
          accessibilityLabel="Optional recipient label"
          value={label}
          onChangeText={onChangeLabel}
          placeholder="For your review only"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={120}
          style={styles.textInput}
        />
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label="Continue" onPress={onContinue} />
      </View>
      <SecondaryButton label="Back to scanner" onPress={onCancel} />
    </View>
  );
}

type ReviewStageProps = {
  draft: PaymentDraft;
  amountInput: string;
  accounts: BankAccount[];
  selectedAccountId: string;
  balanceVisibility: Record<string, boolean>;
  error: string | null;
  isSubmitting: boolean;
  onAmountChange: (value: string) => void;
  onAccountSelect: (accountId: string) => void;
  onConfirm: () => void;
  onContinueInTransfers: () => void;
  onScanAnother: () => void;
};

function ReviewStage({
  draft,
  amountInput,
  accounts,
  selectedAccountId,
  balanceVisibility,
  error,
  isSubmitting,
  onAmountChange,
  onAccountSelect,
  onConfirm,
  onContinueInTransfers,
  onScanAnother,
}: ReviewStageProps) {
  const amountLabel = amountInput ? (() => {
    try {
      return formatIndianMinorUnits(parseAmountToMinorUnits(amountInput));
    } catch {
      return "₹ —";
    }
  })() : "₹ —";

  return (
    <View>
      <Text accessibilityRole="header" style={styles.introTitle}>Review payment</Text>
      <Text style={styles.introDescription}>Check the details before continuing to the labelled demo simulation.</Text>
      <View style={styles.reviewCard}>
        <Text style={styles.reviewSectionLabel}>Recipient</Text>
        <View style={styles.recipientRow}>
          <View style={styles.recipientIcon}>
            <Ionicons name="person-outline" size={22} color={colors.greenDark} />
          </View>
          <View style={styles.recipientCopy}>
            <Text style={styles.recipientName}>{draft.recipient.displayName ?? "Recipient lookup unavailable"}</Text>
            <Text style={styles.recipientAddress}>{draft.recipient.address}</Text>
            <Text style={styles.sourceText}>{draft.recipient.informationSource} · Not verified</Text>
          </View>
        </View>

        <View style={styles.reviewDivider} />
        <Text style={styles.reviewSectionLabel}>Amount</Text>
        {draft.amountSource === "from-qr" ? (
          <View style={styles.lockedAmount}>
            <Text style={styles.amountValue}>{amountLabel}</Text>
            <Text style={styles.sourceText}>Amount from QR</Text>
          </View>
        ) : (
          <View>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                accessibilityLabel="Payment amount"
                value={amountInput}
                onChangeText={onAmountChange}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                maxLength={12}
                style={styles.amountInput}
              />
            </View>
            <Text style={styles.sourceText}>Enter an amount in INR</Text>
          </View>
        )}

        {draft.note ? (
          <View style={styles.noteRow}>
            <Text style={styles.reviewSectionLabel}>Note</Text>
            <Text style={styles.noteText}>{draft.note}</Text>
          </View>
        ) : null}

        <View style={styles.reviewDivider} />
        <Text style={styles.reviewSectionLabel}>Funding account</Text>
        <Text style={styles.sectionDescription}>Fixed and recurring deposits cannot be used for payments.</Text>
        <View style={styles.accountOptions}>
          {accounts.map((account) => {
            const selected = account.id === selectedAccountId;
            const visible = balanceVisibility[account.id] !== false;
            return (
              <Pressable
                key={account.id}
                accessibilityRole="radio"
                accessibilityLabel={`${account.name} ending ${account.lastFour}`}
                accessibilityState={{ selected }}
                onPress={() => onAccountSelect(account.id)}
                style={({ pressed }) => [styles.accountOption, selected && styles.accountOptionSelected, pressed && styles.pressed]}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.accountCopy}>
                  <Text style={styles.accountName}>{account.name} · •••• {account.lastFour}</Text>
                  <Text style={styles.accountBalance}>
                    {visible ? `${formatIndianMinorUnits(accountBalance(account))} available` : "Balance hidden"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.demoReviewBanner}>
          <Ionicons name="information-circle-outline" size={19} color={colors.orange} />
          <Text style={styles.demoReviewText}>Demo mode — no money will be transferred.</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton
          label={draft.amountSource === "from-qr" ? `Simulate payment of ${amountLabel}` : `Simulate payment of ${amountLabel}`}
          onPress={onConfirm}
          disabled={isSubmitting || !selectedAccountId}
          loading={isSubmitting}
        />
        <SecondaryButton label="Continue in Transfer flow" onPress={onContinueInTransfers} />
      </View>
      <SecondaryButton label="Scan another QR" onPress={onScanAnother} />
    </View>
  );
}

type ResultStageProps = {
  attempt: PaymentAttempt;
  resultMessage: string | null;
  isCheckingStatus: boolean;
  onCheckStatus: () => void;
  onHome: () => void;
  onScanAnother: () => void;
};

function ResultStage({
  attempt,
  resultMessage,
  isCheckingStatus,
  onCheckStatus,
  onHome,
  onScanAnother,
}: ResultStageProps) {
  const success = attempt.status === "succeeded";
  const pending = attempt.status === "pending";
  const title = success
    ? "Demo payment completed"
    : pending
      ? "Demo payment pending"
      : "Demo payment failed";
  const icon = success ? "checkmark-circle-outline" : pending ? "time-outline" : "close-circle-outline";
  const iconColor = success ? colors.green : pending ? colors.orange : colors.danger;

  return (
    <View>
      <View style={styles.resultHero}>
        <View style={[styles.resultIcon, { backgroundColor: success ? colors.greenSoft : pending ? colors.orangeSoft : colors.dangerSoft }]}>
          <Ionicons name={icon} size={42} color={iconColor} />
        </View>
        <Text accessibilityRole="header" style={styles.resultTitle}>{title}</Text>
        <Text style={styles.resultSubtitle}>{success ? "Your synthetic demo activity was recorded." : pending ? "The outcome is not final." : "The synthetic demo outcome did not complete."}</Text>
      </View>
      <View style={styles.resultCard}>
        <ResultRow label="Recipient" value={attempt.recipient.displayName ?? attempt.recipient.address} />
        <ResultRow label="UPI ID" value={attempt.recipient.address} />
        <ResultRow label="Amount" value={formatIndianMinorUnits(attempt.amountMinorUnits)} />
        <ResultRow label="Status" value={attempt.status} />
        <ResultRow label="Funding account" value={`${attempt.fundingAccount.name} · •••• ${attempt.fundingAccount.lastFour}`} />
        <ResultRow label="Internal reference" value={attempt.internalReference} />
        <View style={styles.demoResultBanner}>
          <Ionicons name="information-circle-outline" size={19} color={colors.orange} />
          <Text style={styles.demoReviewText}>{attempt.demoDisclosure}</Text>
        </View>
        {attempt.errorMessage ? <Text style={styles.errorText}>{attempt.errorMessage}</Text> : null}
        {resultMessage ? <Text accessibilityLiveRegion="polite" style={styles.resultMessage}>{resultMessage}</Text> : null}
        {pending ? (
          <PrimaryButton label="Check status" onPress={onCheckStatus} loading={isCheckingStatus} disabled={isCheckingStatus} />
        ) : null}
        <PrimaryButton label="Back to Home" onPress={onHome} />
      </View>
      <SecondaryButton label="Scan another QR" onPress={onScanAnother} />
    </View>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      testID={`scan-action-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, disabled && styles.disabledButton, pressed && !disabled && styles.primaryButtonPressed]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function AlternativeButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`scan-option-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.alternativeButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={colors.greenDark} />
      <Text style={styles.alternativeButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    width: "100%",
    flexGrow: 1,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerAction: {
    minWidth: 76,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionText: { marginLeft: 2, color: colors.text, fontSize: 16, fontWeight: "600" },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  helpButton: {
    minWidth: 76,
    minHeight: 48,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  helpText: { color: colors.greenDark, fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  helpCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.greenSoft,
  },
  helpCardText: { flex: 1, marginLeft: 10, color: colors.text, fontSize: 13, lineHeight: 19 },
  introTitle: { marginTop: 10, color: colors.text, fontSize: 26, lineHeight: 33, fontWeight: "800" },
  introDescription: { marginTop: 7, color: colors.secondary, fontSize: 15, lineHeight: 22 },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.orangeSoft,
  },
  demoBannerText: { flex: 1, marginLeft: 8, color: "#8E3B1D", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  cameraMessageCard: {
    alignItems: "center",
    marginTop: 18,
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cameraMessageCardError: { backgroundColor: "#FFFCFB", borderColor: "#F6C8C2" },
  cameraMessageIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.greenSoft,
  },
  cameraMessageTitle: { marginTop: 14, color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  cameraMessageBody: { maxWidth: 420, marginTop: 8, color: colors.secondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  cameraControls: { alignItems: "center", marginTop: 10 },
  cameraHint: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: "center" },
  controlButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: colors.greenSoft,
  },
  controlButtonText: { marginLeft: 7, color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  imagePreviewCard: { flexDirection: "row", alignItems: "center", marginTop: 14, padding: 10, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  imagePreview: { width: 58, height: 58, borderRadius: 10, backgroundColor: "#EEF1F3" },
  imagePreviewCopy: { flex: 1, marginLeft: 11 },
  imagePreviewTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  imagePreviewBody: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  candidateCard: { marginTop: 14, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  sectionDescription: { marginTop: 4, color: colors.secondary, fontSize: 13, lineHeight: 18 },
  candidateButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.greenSoft },
  candidateButtonText: { color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  alternativeSection: { marginTop: 22 },
  alternativeTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  alternativeRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  alternativeButton: { flex: 1, minHeight: 68, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  alternativeButtonText: { marginTop: 5, color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  safetyNote: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, padding: 13, borderRadius: 14, backgroundColor: colors.greenSoft },
  safetyText: { flex: 1, marginLeft: 8, color: colors.greenDark, fontSize: 12, lineHeight: 18 },
  formCard: { marginTop: 18, padding: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fieldLabel: { marginTop: 15, marginBottom: 7, color: colors.text, fontSize: 13, fontWeight: "700" },
  textInput: { minHeight: 50, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16, backgroundColor: "#FCFDFD" },
  errorText: { marginTop: 10, color: colors.danger, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.green },
  primaryButtonPressed: { backgroundColor: colors.greenDark },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textAlign: "center" },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 9, paddingHorizontal: 14, borderRadius: 14 },
  secondaryButtonText: { color: colors.greenDark, fontSize: 14, fontWeight: "800" },
  reviewCard: { marginTop: 18, padding: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reviewSectionLabel: { color: colors.secondary, fontSize: 12, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  recipientRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  recipientIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 23, backgroundColor: colors.greenSoft },
  recipientCopy: { flex: 1, marginLeft: 11 },
  recipientName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  recipientAddress: { marginTop: 3, color: colors.secondary, fontSize: 14 },
  sourceText: { marginTop: 5, color: colors.muted, fontSize: 12, lineHeight: 17 },
  reviewDivider: { height: 1, marginVertical: 18, backgroundColor: colors.border },
  lockedAmount: { marginTop: 10 },
  amountValue: { color: colors.text, fontSize: 28, fontWeight: "800" },
  amountInputWrap: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: "#FCFDFD" },
  currencyPrefix: { color: colors.text, fontSize: 22, fontWeight: "700" },
  amountInput: { flex: 1, minHeight: 54, marginLeft: 8, color: colors.text, fontSize: 23, fontWeight: "700" },
  noteRow: { marginTop: 18 },
  noteText: { marginTop: 6, color: colors.text, fontSize: 14, lineHeight: 20 },
  accountOptions: { marginTop: 10 },
  accountOption: { minHeight: 66, flexDirection: "row", alignItems: "center", marginBottom: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  accountOptionSelected: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  radio: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 2, borderColor: colors.muted },
  radioSelected: { borderColor: colors.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  accountCopy: { flex: 1, marginLeft: 11 },
  accountName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  accountBalance: { marginTop: 3, color: colors.secondary, fontSize: 12 },
  demoReviewBanner: { flexDirection: "row", alignItems: "center", marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.orangeSoft },
  demoReviewText: { flex: 1, marginLeft: 7, color: "#8E3B1D", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  resultHero: { alignItems: "center", marginTop: 24 },
  resultIcon: { width: 78, height: 78, alignItems: "center", justifyContent: "center", borderRadius: 39 },
  resultTitle: { marginTop: 17, color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: "800", textAlign: "center" },
  resultSubtitle: { marginTop: 7, color: colors.secondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  resultCard: { marginTop: 20, padding: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  resultRow: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  resultLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  resultValue: { marginTop: 4, color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  demoResultBanner: { flexDirection: "row", alignItems: "center", marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.orangeSoft },
  resultMessage: { marginTop: 10, color: colors.secondary, fontSize: 13, lineHeight: 19 },
});
