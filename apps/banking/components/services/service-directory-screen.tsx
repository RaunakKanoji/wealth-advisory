import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getServiceCategory,
  getServiceDefinition,
  serviceCategories,
  serviceRegistry,
} from "@/data/services-registry";
import {
  clearRecentServices,
  getServiceAvailability,
  getServicePreferences,
  loadDirectoryResources,
  moveFavourite,
  recordRecentService,
  resolveServiceNavigation,
  searchServices,
  toggleFavourite,
} from "@/services/service-directory-service";
import type { BankAccount } from "@/types/banking";
import type { CardRecord } from "@/types/cards";
import type {
  ServiceAvailability,
  ServiceCategoryId,
  ServiceDefinition,
  ServicePreferences,
  ServiceResourceType,
} from "@/types/services";

const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  text: "#111827",
  secondary: "#6F7888",
  muted: "#98A1AE",
  green: "#007E5D",
  greenDark: "#006647",
  greenSoft: "#E9F5F2",
  orange: "#C43E12",
  orangeSoft: "#FFF2EA",
  border: "#E8EBEF",
  divider: "#EDF0F2",
  danger: "#A62B32",
};

type ResourcePickerState = {
  service: ServiceDefinition;
  resourceType: ServiceResourceType;
  eligibleResourceIds: string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function tabBarHeight(bottomInset: number) {
  return Platform.select({
    ios: 72 + bottomInset,
    android: 66 + Math.max(bottomInset, 10),
    default: 76,
  }) ?? 76;
}

function availabilityFor(
  service: ServiceDefinition,
  resources: Awaited<ReturnType<typeof loadDirectoryResources>> | null,
): ServiceAvailability {
  if (!resources) return { state: "checking", label: "Checking availability" };
  return getServiceAvailability(service, resources);
}

export function ServiceDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const { focusServiceId: rawFocusServiceId } = useLocalSearchParams<{ focusServiceId?: string | string[] }>();
  const customerId = user?.id ?? "demo-customer-a";
  const focusServiceId = firstParam(rawFocusServiceId);
  const scrollRef = useRef<ScrollView>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoryId | "all">("all");
  const [preferences, setPreferences] = useState<ServicePreferences>({ version: 1, favouriteServiceIds: [], recentServices: [] });
  const [resources, setResources] = useState<Awaited<ReturnType<typeof loadDirectoryResources>> | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready">("loading");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [picker, setPicker] = useState<ResourcePickerState | null>(null);
  const [isEditingFavourites, setIsEditingFavourites] = useState(false);
  const [pendingFavouriteId, setPendingFavouriteId] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const loadDirectory = useCallback(async () => {
    setLoadState("loading");
    const [nextPreferences, nextResources] = await Promise.all([
      getServicePreferences({ customerId }),
      loadDirectoryResources(customerId),
    ]);
    setPreferences(nextPreferences);
    setResources(nextResources);
    setLoadState("ready");
  }, [customerId]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useFocusEffect(
    useCallback(() => {
      void loadDirectory();
    }, [loadDirectory]),
  );

  useEffect(() => {
    const focusedService = focusServiceId ? getServiceDefinition(focusServiceId) : undefined;
    if (!focusedService) return;
    setSelectedCategory(focusedService.categoryId);
    setQuery("");
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  }, [focusServiceId]);

  const queryActive = query.trim().length > 0;
  const filteredServices = useMemo(
    () => searchServices(query, selectedCategory),
    [query, selectedCategory],
  );
  const allQueryMatches = useMemo(
    () => queryActive ? searchServices(query, "all") : [],
    [query, queryActive],
  );
  const categoryDefinitions = serviceCategories.filter((category) => serviceRegistry.some((service) => service.categoryId === category.id));
  const favouriteServices = preferences.favouriteServiceIds
    .map((id) => getServiceDefinition(id))
    .filter((service): service is ServiceDefinition => Boolean(service))
    .filter((service) => selectedCategory === "all" || service.categoryId === selectedCategory);
  const recentServices = preferences.recentServices
    .map((item) => getServiceDefinition(item.serviceId))
    .filter((service): service is ServiceDefinition => Boolean(service))
    .filter((service) => selectedCategory === "all" || service.categoryId === selectedCategory);
  const groupedServices = useMemo(() => {
    if (queryActive) return [{ title: "Search results", services: filteredServices }];
    return categoryDefinitions
      .filter((category) => selectedCategory === "all" || category.id === selectedCategory)
      .map((category) => ({
        title: category.title,
        services: searchServices("", category.id),
      }))
      .filter((section) => section.services.length > 0);
  }, [categoryDefinitions, filteredServices, queryActive, selectedCategory]);

  const horizontalPadding = width < 375 ? 16 : 20;
  const contentWidth = Math.min(width - horizontalPadding * 2, 860);
  const compactColumns = width >= 360;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/more");
  };

  const navigateToService = useCallback(async (service: ServiceDefinition, context?: { accountId?: string; cardId?: string }) => {
    const href = resolveServiceNavigation(service, context);
    if (!href) return;
    router.push(href);

    try {
      const nextPreferences = await recordRecentService(service.id, { customerId });
      setPreferences(nextPreferences);
    } catch {
      setPreferenceError("The service opened, but it could not be added to Recently opened.");
    }
  }, [customerId, router]);

  const openService = useCallback(async (service: ServiceDefinition) => {
    setPreferenceError(null);
    const availability = availabilityFor(service, resources);
    if (availability.state === "checking") {
      Alert.alert("Checking availability", "Please try again in a moment while the relevant account or card is checked.");
      return;
    }
    if (availability.state === "information") {
      await navigateToService(service);
      return;
    }
    if (availability.state === "unavailable") {
      Alert.alert(`${service.title} unavailable`, availability.reason ?? "This service is not available for the current profile.");
      return;
    }
    if (!service.requiresResource) {
      await navigateToService(service);
      return;
    }
    const resourceIds = availability.eligibleResourceIds ?? [];
    if (resourceIds.length === 1) {
      await navigateToService(service, service.requiresResource === "account" ? { accountId: resourceIds[0] } : { cardId: resourceIds[0] });
    } else {
      setPicker({ service, resourceType: service.requiresResource, eligibleResourceIds: resourceIds });
    }
  }, [navigateToService, resources]);

  const toggleServiceFavourite = async (service: ServiceDefinition) => {
    setPendingFavouriteId(service.id);
    setPreferenceError(null);
    try {
      const nextPreferences = await toggleFavourite(service.id, { customerId });
      setPreferences(nextPreferences);
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : "Favourite could not be saved. Try again.");
    } finally {
      setPendingFavouriteId(null);
    }
  };

  const clearRecents = async () => {
    try {
      setPreferences(await clearRecentServices({ customerId }));
    } catch {
      setPreferenceError("Recently opened services could not be cleared. Try again.");
    }
  };

  const moveServiceFavourite = async (serviceId: string, direction: "earlier" | "later") => {
    try {
      setPreferences(await moveFavourite(serviceId, direction, { customerId }));
    } catch {
      setPreferenceError("Favourite order could not be saved. Try again.");
    }
  };

  const selectedCategoryLabel = selectedCategory === "all" ? "All services" : getServiceCategory(selectedCategory).title;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 + tabBarHeight(insets.bottom) }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { maxWidth: contentWidth, paddingHorizontal: horizontalPadding }]}>
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={23} color={colors.text} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Services help" onPress={() => void openService(getServiceDefinition("help-center")!)} style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}>
              <Ionicons name="help-circle-outline" size={21} color={colors.greenDark} />
              <Text style={styles.helpText}>Help</Text>
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <View style={styles.titleColumn}>
              <Text accessibilityRole="header" style={styles.title}>All Services</Text>
              <Text style={styles.subtitle}>Find banking tools, account services, and financial guidance.</Text>
            </View>
            {loadState === "ready" ? <Text style={styles.catalogueCount}>{serviceRegistry.length} services</Text> : null}
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={21} color={colors.secondary} />
            <TextInput
              accessibilityLabel="Search services"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="never"
              onChangeText={setQuery}
              placeholder="Try ‘statement’, ‘transfer’, or ‘card limits’"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear service search" hitSlop={8} onPress={() => setQuery("")} style={styles.clearSearchButton}>
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.categoryHeader}>
            <Text style={styles.controlLabel}>Browse by category</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose service category" accessibilityState={{ expanded: isCategoryModalOpen }} onPress={() => setIsCategoryModalOpen(true)} style={({ pressed }) => [styles.chooseCategoryButton, pressed && styles.pressed]}>
              <Ionicons name="list-outline" size={17} color={colors.greenDark} />
              <Text style={styles.chooseCategoryText}>{selectedCategoryLabel}</Text>
              <Ionicons name="chevron-down" size={17} color={colors.greenDark} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            <CategoryChip label="All" selected={selectedCategory === "all"} onPress={() => setSelectedCategory("all")} />
            {categoryDefinitions.map((category) => (
              <CategoryChip key={category.id} label={category.shortTitle} selected={selectedCategory === category.id} onPress={() => setSelectedCategory(category.id)} />
            ))}
          </ScrollView>

          {preferenceError ? (
            <View style={styles.preferenceError}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.preferenceErrorText}>{preferenceError}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss services message" onPress={() => setPreferenceError(null)}><Ionicons name="close" size={18} color={colors.danger} /></Pressable>
            </View>
          ) : null}

          {queryActive ? (
            <View style={styles.searchSummary} accessibilityLiveRegion="polite">
              <Text style={styles.resultCount}>{filteredServices.length} {filteredServices.length === 1 ? "service" : "services"} found</Text>
              {selectedCategory !== "all" && filteredServices.length === 0 && allQueryMatches.length > 0 ? (
                <Pressable accessibilityRole="button" onPress={() => setSelectedCategory("all")} style={styles.searchAllButton}>
                  <Text style={styles.searchAllText}>Search all categories</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {!queryActive && favouriteServices.length > 0 ? (
            <View style={styles.section}>
              <SectionHeading title="Favourites" actionLabel={isEditingFavourites ? "Done" : "Edit"} onAction={() => setIsEditingFavourites((editing) => !editing)} />
              <View style={[styles.favouritesGrid, !compactColumns && styles.favouritesSingleColumn]}>
                {favouriteServices.map((service, index) => (
                  <FavouriteTile
                    key={service.id}
                    service={service}
                    availability={availabilityFor(service, resources)}
                    isEditing={isEditingFavourites}
                    isFirst={index === 0}
                    isLast={index === favouriteServices.length - 1}
                    isPending={pendingFavouriteId === service.id}
                    onPress={() => void openService(service)}
                    onToggleFavourite={() => void toggleServiceFavourite(service)}
                    onMoveEarlier={() => void moveServiceFavourite(service.id, "earlier")}
                    onMoveLater={() => void moveServiceFavourite(service.id, "later")}
                  />
                ))}
              </View>
            </View>
          ) : !queryActive ? (
            <View style={styles.emptyFavourites}>
              <Ionicons name="star-outline" size={22} color={colors.green} />
              <View style={styles.emptyFavouritesCopy}>
                <Text style={styles.emptyTitle}>Keep your most-used services here.</Text>
                <Text style={styles.emptyDescription}>Choose favourites from the catalogue for quick access.</Text>
              </View>
            </View>
          ) : null}

          {!queryActive && recentServices.length > 0 ? (
            <View style={styles.section}>
              <SectionHeading title="Recently opened" actionLabel="Clear" onAction={() => void clearRecents()} />
              <View style={styles.surfaceCard}>
                {recentServices.map((service, index) => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    availability={availabilityFor(service, resources)}
                    isFavourite={preferences.favouriteServiceIds.includes(service.id)}
                    isPendingFavourite={pendingFavouriteId === service.id}
                    showDivider={index < recentServices.length - 1}
                    onPress={() => void openService(service)}
                    onToggleFavourite={() => void toggleServiceFavourite(service)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={[styles.catalogueSection, queryActive && styles.catalogueSearchSection]}>
            {groupedServices.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.surfaceCard}>
                  {section.services.map((service, index) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      availability={availabilityFor(service, resources)}
                      isFavourite={preferences.favouriteServiceIds.includes(service.id)}
                      isPendingFavourite={pendingFavouriteId === service.id}
                      showDivider={index < section.services.length - 1}
                      onPress={() => void openService(service)}
                      onToggleFavourite={() => void toggleServiceFavourite(service)}
                    />
                  ))}
                </View>
              </View>
            ))}
            {queryActive && filteredServices.length === 0 ? (
              <View style={styles.noResultsCard}>
                <Ionicons name="search-outline" size={29} color={colors.muted} />
                <Text style={styles.noResultsTitle}>No services found</Text>
                <Text style={styles.noResultsDescription}>Try “statement”, “transfer”, “card limits”, or another banking task.</Text>
                <Pressable accessibilityRole="button" onPress={() => { setQuery(""); setSelectedCategory("all"); }} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Clear search</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.helpCard}>
            <View style={styles.helpIcon}><Ionicons name="help-circle-outline" size={24} color={colors.green} /></View>
            <View style={styles.helpCopy}><Text style={styles.helpTitle}>Need help finding a task?</Text><Text style={styles.helpDescription}>Search by what you want to do, or open Help center for the current support options.</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Open Help center" onPress={() => void openService(getServiceDefinition("help-center")!)} style={styles.helpLink}><Text style={styles.helpLinkText}>Help</Text><Ionicons name="arrow-forward" size={17} color={colors.greenDark} /></Pressable>
          </View>
        </View>
      </ScrollView>

      <CategoryModal
        visible={isCategoryModalOpen}
        selectedCategory={selectedCategory}
        categories={categoryDefinitions}
        onClose={() => setIsCategoryModalOpen(false)}
        onSelect={(category) => { setSelectedCategory(category); setIsCategoryModalOpen(false); }}
      />
      <ResourcePickerModal
        picker={picker}
        accounts={resources?.accounts ?? []}
        cards={resources?.cards ?? []}
        onClose={() => setPicker(null)}
        onSelect={(resourceId) => {
          if (!picker) return;
          const context = picker.resourceType === "account" ? { accountId: resourceId } : { cardId: resourceId };
          setPicker(null);
          void navigateToService(picker.service, context);
        }}
      />
    </View>
  );
}

function CategoryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Show ${label.toLowerCase()} services`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.categoryChip, selected && styles.categoryChipSelected, pressed && styles.pressed]}>
      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SectionHeading({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <View style={styles.sectionHeading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}><Text style={styles.sectionActionText}>{actionLabel}</Text></Pressable>
    </View>
  );
}

function AvailabilityBadge({ availability }: { availability: ServiceAvailability }) {
  const isInformation = availability.state === "information";
  const isUnavailable = availability.state === "unavailable";
  return <Text style={[styles.availabilityBadge, isInformation && styles.informationBadge, isUnavailable && styles.unavailableBadge]}>{availability.label}</Text>;
}

function ServiceIcon({ service }: { service: ServiceDefinition }) {
  const iconColor = service.iconTone === "green" ? colors.green : colors.orange;
  const iconBackground = service.iconTone === "green" ? colors.greenSoft : colors.orangeSoft;
  return <View style={[styles.serviceIcon, { backgroundColor: iconBackground }]}>{service.icon.family === "material-community" ? <MaterialCommunityIcons name={service.icon.name} size={23} color={iconColor} /> : <Ionicons name={service.icon.name} size={23} color={iconColor} />}</View>;
}

function FavouriteButton({ service, isFavourite, isPending, onPress }: { service: ServiceDefinition; isFavourite: boolean; isPending: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${isFavourite ? "Remove" : "Add"} ${service.title} ${isFavourite ? "from" : "to"} favourites`} accessibilityState={{ busy: isPending, selected: isFavourite }} disabled={isPending} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.favouriteButton, pressed && styles.pressed]}><Ionicons name={isFavourite ? "star" : "star-outline"} size={21} color={isFavourite ? colors.green : colors.muted} /></Pressable>;
}

function ServiceRow({ service, availability, isFavourite, isPendingFavourite, showDivider, onPress, onToggleFavourite }: { service: ServiceDefinition; availability: ServiceAvailability; isFavourite: boolean; isPendingFavourite: boolean; showDivider: boolean; onPress: () => void; onToggleFavourite: () => void }) {
  return (
    <View>
      <View style={styles.serviceRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${service.title}`} accessibilityHint={service.description} onPress={onPress} style={({ pressed }) => [styles.serviceRowMain, pressed && styles.pressed]}>
          <ServiceIcon service={service} />
          <View style={styles.serviceRowCopy}>
            <Text style={styles.serviceRowTitle}>{service.title}</Text>
            <Text style={styles.serviceRowDescription}>{service.description}</Text>
            <View style={styles.badgeRow}><AvailabilityBadge availability={availability} />{service.environment === "demo" ? <Text style={styles.environmentText}>Demo</Text> : null}</View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        {service.favouriteAllowed ? <FavouriteButton service={service} isFavourite={isFavourite} isPending={isPendingFavourite} onPress={onToggleFavourite} /> : null}
      </View>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

function FavouriteTile({ service, availability, isEditing, isFirst, isLast, isPending, onPress, onToggleFavourite, onMoveEarlier, onMoveLater }: { service: ServiceDefinition; availability: ServiceAvailability; isEditing: boolean; isFirst: boolean; isLast: boolean; isPending: boolean; onPress: () => void; onToggleFavourite: () => void; onMoveEarlier: () => void; onMoveLater: () => void }) {
  return (
    <View style={styles.favouriteTile}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open favourite ${service.title}`} onPress={onPress} style={({ pressed }) => [styles.favouriteTileMain, pressed && styles.pressed]}>
        <ServiceIcon service={service} />
        <Text style={styles.favouriteTileTitle}>{service.title}</Text>
        <AvailabilityBadge availability={availability} />
      </Pressable>
      <View style={styles.favouriteStar}><FavouriteButton service={service} isFavourite isPending={isPending} onPress={onToggleFavourite} /></View>
      {isEditing ? <View style={styles.reorderControls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Move ${service.title} earlier`} disabled={isFirst} onPress={onMoveEarlier} style={[styles.reorderButton, isFirst && styles.disabled]}><Ionicons name="chevron-up" size={17} color={isFirst ? colors.muted : colors.greenDark} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Move ${service.title} later`} disabled={isLast} onPress={onMoveLater} style={[styles.reorderButton, isLast && styles.disabled]}><Ionicons name="chevron-down" size={17} color={isLast ? colors.muted : colors.greenDark} /></Pressable>
      </View> : null}
    </View>
  );
}

function CategoryModal({ visible, selectedCategory, categories, onClose, onSelect }: { visible: boolean; selectedCategory: ServiceCategoryId | "all"; categories: { id: ServiceCategoryId; title: string }[]; onClose: () => void; onSelect: (category: ServiceCategoryId | "all") => void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Choose category</Text><Pressable accessibilityRole="button" accessibilityLabel="Close category chooser" onPress={onClose}><Ionicons name="close" size={23} color={colors.text} /></Pressable></View><Pressable accessibilityRole="button" accessibilityState={{ selected: selectedCategory === "all" }} onPress={() => onSelect("all")} style={styles.modalOption}><Text style={styles.modalOptionText}>All services</Text>{selectedCategory === "all" ? <Ionicons name="checkmark" size={20} color={colors.green} /> : null}</Pressable>{categories.map((category) => <Pressable key={category.id} accessibilityRole="button" accessibilityState={{ selected: selectedCategory === category.id }} onPress={() => onSelect(category.id)} style={styles.modalOption}><Text style={styles.modalOptionText}>{category.title}</Text>{selectedCategory === category.id ? <Ionicons name="checkmark" size={20} color={colors.green} /> : null}</Pressable>)}</View></View></Modal>;
}

function ResourcePickerModal({ picker, accounts, cards, onClose, onSelect }: { picker: ResourcePickerState | null; accounts: BankAccount[]; cards: CardRecord[]; onClose: () => void; onSelect: (resourceId: string) => void }) {
  const eligibleResourceIds = picker?.eligibleResourceIds ?? [];
  const accountOptions = accounts.filter((account) => picker?.service.requiresResource === "account" && account.status === "active" && eligibleResourceIds.includes(account.id));
  const cardOptions = cards.filter((card) => picker?.service.requiresResource === "card" && card.lifecycleStatus !== "expired" && eligibleResourceIds.includes(card.id));
  const options = picker?.resourceType === "account" ? accountOptions : cardOptions;
  return <Modal visible={Boolean(picker)} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Choose {picker?.resourceType === "card" ? "a card" : "an account"}</Text><Text style={styles.modalSubtitle}>{picker?.service.title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close resource chooser" onPress={onClose}><Ionicons name="close" size={23} color={colors.text} /></Pressable></View>{options.map((resource) => { const label = "name" in resource ? resource.name : resource.nickname ?? resource.productName; const sublabel = "lastFour" in resource ? `Ending in ${resource.lastFour}` : ""; return <Pressable key={resource.id} accessibilityRole="button" accessibilityLabel={`Choose ${label}`} onPress={() => onSelect(resource.id)} style={styles.resourceOption}><View style={styles.resourceOptionCopy}><Text style={styles.modalOptionText}>{label}</Text><Text style={styles.resourceOptionSubtext}>{sublabel}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>; })}</View></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", alignSelf: "center", paddingTop: 15 },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center" },
  backText: { marginLeft: 2, color: colors.text, fontSize: 16, fontWeight: "600" },
  helpButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8 },
  helpText: { color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 13 },
  titleColumn: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 30, lineHeight: 38, fontWeight: "700" },
  subtitle: { marginTop: 5, color: colors.secondary, fontSize: 15, lineHeight: 22 },
  catalogueCount: { paddingBottom: 5, color: colors.muted, fontSize: 12, fontWeight: "700" },
  searchContainer: { minHeight: 54, flexDirection: "row", alignItems: "center", marginTop: 22, paddingHorizontal: 15, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, minWidth: 0, marginLeft: 10, paddingVertical: 13, color: colors.text, fontSize: 15 },
  clearSearchButton: { minWidth: 32, minHeight: 44, alignItems: "center", justifyContent: "center" },
  categoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 22 },
  controlLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
  chooseCategoryButton: { minHeight: 40, maxWidth: "60%", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.greenSoft },
  chooseCategoryText: { flexShrink: 1, color: colors.greenDark, fontSize: 12, fontWeight: "700" },
  categoryScroll: { gap: 8, paddingTop: 11, paddingBottom: 2 },
  categoryChip: { minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 15, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  categoryChipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  categoryChipText: { color: colors.secondary, fontSize: 13, fontWeight: "700" },
  categoryChipTextSelected: { color: "#FFFFFF" },
  preferenceError: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 13, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#FFF2F2", borderWidth: 1, borderColor: "#F2CECE" },
  preferenceErrorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  searchSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 21 },
  resultCount: { color: colors.secondary, fontSize: 13, fontWeight: "700" },
  searchAllButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 9 },
  searchAllText: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  section: { marginTop: 25 },
  catalogueSection: { marginTop: 1 },
  catalogueSearchSection: { marginTop: 11 },
  sectionHeading: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 20, lineHeight: 27, fontWeight: "700" },
  sectionAction: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8 },
  sectionActionText: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  surfaceCard: { overflow: "hidden", borderRadius: 19, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  serviceRow: { minHeight: 105, flexDirection: "row", alignItems: "center", paddingLeft: 14, paddingRight: 8, paddingVertical: 10 },
  serviceRowMain: { flex: 1, minWidth: 0, minHeight: 76, flexDirection: "row", alignItems: "center", paddingRight: 6 },
  serviceRowCopy: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 6 },
  serviceRowTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  serviceRowDescription: { marginTop: 3, color: colors.secondary, fontSize: 13, lineHeight: 18 },
  badgeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 },
  availabilityBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.greenSoft, color: colors.greenDark, fontSize: 10, fontWeight: "700" },
  informationBadge: { backgroundColor: colors.orangeSoft, color: colors.orange },
  unavailableBadge: { backgroundColor: "#F1F2F4", color: colors.secondary },
  environmentText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  serviceIcon: { width: 45, height: 45, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 23 },
  favouriteButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70, backgroundColor: colors.divider },
  favouritesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  favouritesSingleColumn: { flexDirection: "column" },
  favouriteTile: { position: "relative", minHeight: 126, flex: 1, minWidth: 0, borderRadius: 18, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  favouriteTileMain: { minHeight: 126, padding: 14, paddingRight: 48 },
  favouriteTileTitle: { marginTop: 10, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  favouriteStar: { position: "absolute", top: 5, right: 5 },
  reorderControls: { position: "absolute", right: 8, bottom: 6, flexDirection: "row", gap: 2 },
  reorderButton: { minWidth: 30, minHeight: 30, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.greenSoft },
  disabled: { opacity: 0.45 },
  emptyFavourites: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 25, padding: 16, borderRadius: 18, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: "#D5EEE7" },
  emptyFavouritesCopy: { flex: 1 },
  emptyTitle: { color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  emptyDescription: { marginTop: 3, color: colors.secondary, fontSize: 13, lineHeight: 18 },
  noResultsCard: { alignItems: "center", marginTop: 24, padding: 28, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  noResultsTitle: { marginTop: 12, color: colors.text, fontSize: 18, fontWeight: "700" },
  noResultsDescription: { maxWidth: 330, marginTop: 6, color: colors.secondary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  secondaryButton: { minHeight: 44, justifyContent: "center", marginTop: 16, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.greenSoft },
  secondaryButtonText: { color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  helpCard: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 28, padding: 15, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  helpIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: colors.greenSoft },
  helpCopy: { flex: 1, minWidth: 0 },
  helpTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  helpDescription: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  helpLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 },
  helpLinkText: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.38)" },
  modalCard: { maxHeight: "82%", padding: 20, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  modalHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  modalSubtitle: { marginTop: 3, color: colors.secondary, fontSize: 13 },
  modalOption: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  modalOptionText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  resourceOption: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  resourceOptionCopy: { flex: 1 },
  resourceOptionSubtext: { marginTop: 3, color: colors.secondary, fontSize: 13 },
  pressed: { opacity: 0.72 },
});
