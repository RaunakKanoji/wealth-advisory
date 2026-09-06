import { CameraView, type BarcodeScanningResult, type CameraType } from "expo-camera";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type ScannerViewportProps = {
  facing: CameraType;
  statusLabel: string;
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  onCameraReady: () => void;
  onMountError: (message: string) => void;
};

const scanFrame = {
  left: 0.12,
  top: 0.18,
  width: 0.76,
  height: 0.64,
};

function isResultInsideScanFrame(
  result: BarcodeScanningResult,
  viewportWidth: number,
  viewportHeight: number,
) {
  const bounds = result.bounds;
  if (!bounds?.origin || !bounds.size || viewportWidth <= 0 || viewportHeight <= 0) {
    // Some native camera implementations omit bounds. In that case Expo's QR
    // decoder is the source of truth and the visible frame remains guidance.
    return true;
  }

  const centerX = bounds.origin.x + bounds.size.width / 2;
  const centerY = bounds.origin.y + bounds.size.height / 2;
  return (
    centerX >= viewportWidth * scanFrame.left
    && centerX <= viewportWidth * (scanFrame.left + scanFrame.width)
    && centerY >= viewportHeight * scanFrame.top
    && centerY <= viewportHeight * (scanFrame.top + scanFrame.height)
  );
}

export function ScannerViewport({
  facing,
  statusLabel,
  onBarcodeScanned,
  onCameraReady,
  onMountError,
}: ScannerViewportProps) {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const handleBarcodeScanned = useCallback((result: BarcodeScanningResult) => {
    if (isResultInsideScanFrame(result, viewportSize.width, viewportSize.height)) {
      onBarcodeScanned(result);
    }
  }, [onBarcodeScanned, viewportSize]);

  return (
    <View
      accessible
      accessibilityLabel="Camera scanner"
      style={styles.viewport}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setViewportSize({ width, height });
      }}
    >
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        mute
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleBarcodeScanned}
        onCameraReady={onCameraReady}
        onMountError={(event) => onMountError(event.message)}
      />

      <View pointerEvents="none" style={styles.scrim} />
      <View pointerEvents="none" style={styles.frame}>
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
      </View>
      <View pointerEvents="none" style={styles.statusPill}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{statusLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width: "100%",
    aspectRatio: 0.88,
    minHeight: 300,
    maxHeight: 480,
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: "#07110F",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 12, 10, 0.36)",
  },
  frame: {
    position: "absolute",
    left: "12%",
    top: "18%",
    width: "76%",
    height: "64%",
    borderRadius: 22,
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: "#46D1A5",
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  statusPill: {
    position: "absolute",
    alignSelf: "center",
    bottom: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: "#46D1A5",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
