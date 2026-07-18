import React, { useEffect, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import type { BankAccount } from "@/types/banking";

import { FeaturedAccountCard } from "./featured-account-card";

const CARD_PEEK = 22;
const CARD_GAP = 12;

type AccountCarouselProps = {
  accounts: BankAccount[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onAccountPress: (account: BankAccount) => void;
};

export function AccountCarousel({
  accounts,
  activeIndex,
  onIndexChange,
  onAccountPress,
}: AccountCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList<BankAccount>>(null);
  const isTablet = screenWidth >= 768;
  const horizontalPadding = screenWidth < 375 ? 16 : 20;
  const availableWidth = screenWidth - horizontalPadding * 2 - CARD_PEEK;
  const cardWidth = Math.min(
    isTablet ? 640 : availableWidth,
    availableWidth,
  );
  const snapInterval = cardWidth + CARD_GAP;

  useEffect(() => {
    if (activeIndex < accounts.length) {
      flatListRef.current?.scrollToOffset({
        offset: activeIndex * snapInterval,
        animated: true,
      });
    }
  }, [activeIndex, accounts.length, snapInterval]);

  const handleScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / snapInterval,
    );

    if (
      nextIndex >= 0 &&
      nextIndex < accounts.length &&
      nextIndex !== activeIndex
    ) {
      onIndexChange(nextIndex);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={accounts}
        horizontal
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth, marginRight: CARD_GAP }}>
            <FeaturedAccountCard
              account={item}
              width={cardWidth}
              onPress={() => onAccountPress(item)}
            />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={snapInterval}
        contentContainerStyle={styles.contentContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: -20,
  },
  contentContainer: {
    paddingLeft: 20,
    paddingRight: CARD_PEEK,
    paddingVertical: 4,
  },
});
