import React, { useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { BankAccount } from "../../types/banking";
import AccountCard from "./account-card";

type AccountCarouselProps = {
  accounts: BankAccount[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
};

export default function AccountCarousel({
  accounts,
  activeIndex,
  onIndexChange,
}: AccountCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const cardWidth = isTablet ? 620 : screenWidth - 56;
  const gap = 16;
  const snapInterval = cardWidth + gap;
  const flatListRef = useRef<FlatList<BankAccount>>(null);

  // Expose scrolling function to dots
  React.useEffect(() => {
    if (flatListRef.current && accounts.length > activeIndex) {
      flatListRef.current.scrollToIndex({
        index: activeIndex,
        animated: true,
      });
    }
  }, [activeIndex, accounts.length]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / snapInterval);
    if (index >= 0 && index < accounts.length && index !== activeIndex) {
      onIndexChange(index);
    }
  };

  const renderItem = ({ item }: { item: BankAccount }) => {
    return (
      <View style={{ width: cardWidth }}>
        <AccountCard account={item} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
        style={{ overflow: "visible" }}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        contentContainerStyle={{
          paddingLeft: 20,
          paddingRight: 20,
          paddingVertical: 20, // Extra space to prevent shadow clipping
          columnGap: gap,
        }}
        // Prevent scrollToIndex out of bounds warning
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
});
