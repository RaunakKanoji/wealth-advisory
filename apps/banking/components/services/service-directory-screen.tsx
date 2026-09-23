import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import { useUser } from "@clerk/expo";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { getServiceDefinition, isMvpService, serviceCategories, serviceRegistry } from "@/data/services-registry";
import {
  getServiceAvailability,
  getServicePreferences,
  loadDirectoryResources,
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
import { appColors, appRadii, appSpacing, appTypography } from "@/components/theme/tokens";
import { isRemoteDataEnabled } from "@/lib/env";
import { useServiceCatalog } from "@/lib/api/hooks";
import type { ApiService } from "@/lib/api/types";

const PAGE_GUTTER = appSpacing.xl;
const TABLET_CONTENT_MAX_WIDTH = 860;

const colors = {
  background: appColors.background,
  surface: appColors.surface,
  text: appColors.textPrimary,
  secondary: appColors.textSecondary,
  muted: appColors.textMuted,
  surfaceMuted: appColors.surfaceMuted,
  green: appColors.primary,
  greenDark: appColors.primaryPressed,
  greenSoft: appColors.primarySoft,
  orange: appColors.orangeText,
  orangeSoft: appColors.warningSoft,
  border: appColors.border,
  divider: appColors.divider,
  danger: appColors.danger,
};

type ResourcePickerState = {
  service: ServiceDefinition;
  resourceType: ServiceResourceType;
  eligibleResourceIds: string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const serviceCategoryMap: Record<string, ServiceCategoryId> = {
  accounts: "accounts-deposits",
  payments: "payments-transfers",
  cards: "cards",
  wealth: "wealth-planning",
  loans: "loans-insurance",
  documents: "documents-requests",
  security: "profile-security",
  support: "help-support",
};

const serviceIdMap: Record<string, string> = {
  "lost-card": "lost-stolen-card",
  "wealth-coach": "ask-wealth-coach",
  investments: "investments-overview",
  profile: "my-profile",
  privacy: "privacy-consent",
  "branch-atm": "branch-atm-locator",
};

function localServiceId(slug: string): string {
  return serviceIdMap[slug] ?? slug;
}

function hydrateApiService(service: ApiService): ServiceDefinition | undefined {
  const local = getServiceDefinition(localServiceId(service.slug));
  const categoryId = serviceCategoryMap[service.category];
  if (!local || !categoryId) return undefined;
  return {
    ...local,
    title: service.title,
    description: service.description,
    categoryId,
    aliases: service.searchTerms,
    sortOrder: service.displayOrder,
  };
}

function availabilityFor(
  service: ServiceDefinition,
  resources: Awaited<ReturnType<typeof loadDirectoryResources>> | null,
): ServiceAvailability {
  if (service.destination.kind === "information") {
    return { state: "information", label: "Information", reason: service.availabilityDescription };
  }
  if (!service.requiresResource && !resources) return { state: "available", label: "Available" };
  if (!resources) return { state: "checking", label: "Checking availability" };
  return getServiceAvailability(service, resources);
}

export function ServiceDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useUser();
  const remoteCatalog = useServiceCatalog();
  const { focusServiceId: rawFocusServiceId } = useLocalSearchParams<{ focusServiceId?: string | string[] }>();
  const customerId = user?.id ?? "demo-customer-a";
  const focusServiceId = firstParam(rawFocusServiceId);
  const scrollRef = useRef<ScrollView>(null);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoryId | "all">("all");
  const [preferences, setPreferences] = useState<ServicePreferences>({ version: 1, favouriteServiceIds: [], recentServices: [] });
  const [resources, setResources] = useState<Awaited<ReturnType<typeof loadDirectoryResources>> | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picker, setPicker] = useState<ResourcePickerState | null>(null);
  const [pendingFavouriteId, setPendingFavouriteId] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const remoteServices = useMemo(
    () => remoteCatalog.data?.items.flatMap((service) => {
      const hydrated = hydrateApiService(service);
      return hydrated && isMvpService(hydrated) ? [hydrated] : [];
    }) ?? [],
    [remoteCatalog.data],
  );
  // A live catalogue response is authoritative. An empty or failed response
  // must not silently repopulate the directory from local fixtures.
  const catalogueServices = isRemoteDataEnabled
    ? remoteServices
    : serviceRegistry.filter(isMvpService);
  const searchDirectoryServices = useCallback(
    (searchQuery: string, categoryId: ServiceCategoryId | "all") => searchServices(searchQuery, categoryId, catalogueServices),
    [catalogueServices],
  );

  const loadDirectory = useCallback(async () => {
    if (isRemoteDataEnabled) return;
    setLoadState("loading");
    setLoadError(null);
    try {
      const [nextPreferences, nextResources] = await Promise.all([
        getServicePreferences({ customerId }),
        loadDirectoryResources(customerId),
      ]);
      setPreferences(nextPreferences);
      setResources(nextResources);
      setLoadState("ready");
    } catch {
      setLoadError("Unable to load services. Please try again.");
      setLoadState("error");
    }
  }, [customerId]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (!isRemoteDataEnabled) return;
    if (remoteCatalog.isLoading) {
      setLoadState("loading");
      return;
    }
    if (remoteCatalog.error) {
      setLoadError("Unable to load services from the banking API. Please try again.");
      setLoadState("error");
      return;
    }
    if (remoteCatalog.data) {
      setPreferences({
        version: 1,
        favouriteServiceIds: remoteServices.filter((service) => remoteCatalog.data?.items.find((item) => localServiceId(item.slug) === service.id)?.isFavorite).map((service) => service.id),
        recentServices: [],
      });
      setLoadState("ready");
      void loadDirectoryResources(customerId).then(setResources).catch(() => setResources(null));
    }
  }, [customerId, loadDirectory, remoteCatalog.data, remoteCatalog.error, remoteCatalog.isLoading, remoteServices]);

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
    () => searchDirectoryServices(query, selectedCategory),
    [query, searchDirectoryServices, selectedCategory],
  );
  const allQueryMatches = useMemo(
    () => queryActive ? searchDirectoryServices(query, "all") : [],
    [query, queryActive, searchDirectoryServices],
  );
  const categoryDefinitions = serviceCategories.filter((category) => catalogueServices.some((service) => service.categoryId === category.id));
  const favouriteServices = preferences.favouriteServiceIds
    .map((id) => catalogueServices.find((service) => service.id === id))
    .filter((service): service is ServiceDefinition => Boolean(service))
    .filter((service) => service.favouriteAllowed);
  const quickAccessServices = useMemo(() => {
    const defaults = ["transfer-money", "scan-qr", "my-cards", "account-statements"]
      .map((id) => catalogueServices.find((service) => service.id === id))
      .filter((service): service is ServiceDefinition => Boolean(service));
    return [...favouriteServices, ...defaults]
      .filter((service, index, services) => services.findIndex((item) => item.id === service.id) === index)
      .slice(0, 4);
  }, [catalogueServices, favouriteServices]);
  const groupedServices = useMemo(() => {
    if (queryActive) return [{ title: "Search results", services: filteredServices }];
    return categoryDefinitions
      .filter((category) => selectedCategory === "all" || category.id === selectedCategory)
      .map((category) => ({
        title: category.title,
        services: searchDirectoryServices("", category.id),
      }))
      .filter((section) => section.services.length > 0);
  }, [categoryDefinitions, filteredServices, queryActive, searchDirectoryServices, selectedCategory]);

  const contentFrame = {
    maxWidth: width >= 768 ? TABLET_CONTENT_MAX_WIDTH : undefined,
    paddingHorizontal: PAGE_GUTTER,
  };
  const quickAccessColumns = width < 360 ? 2 : 4;

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
      setPreferenceError("The service opened, but recent service activity could not be saved.");
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

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.fixedHeader}>
        <View style={[styles.content, contentFrame]}>
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={23} color={colors.text} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Services help" onPress={() => void openService(getServiceDefinition("help-center")!)} style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}>
              <Ionicons name="help-circle-outline" size={20} color={colors.greenDark} />
              <Text style={styles.helpText}>Help</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: appSpacing.xxl + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, contentFrame]}>
          <Text accessibilityRole="header" style={styles.title}>All Services</Text>
          <Text style={styles.subtitle}>Everything you need to manage your banking.</Text>

          {loadState === "loading" ? (
            <View accessible accessibilityLabel="Loading service search" style={[styles.searchContainer, styles.searchSkeleton]}>
              <View style={styles.searchSkeletonIcon} />
              <View style={styles.searchSkeletonLine} />
            </View>
          ) : (
            <View style={[styles.searchContainer, searchFocused && styles.searchContainerFocused]}>
              <Ionicons name="search-outline" size={21} color={colors.secondary} />
              <TextInput
                accessibilityLabel="Search services"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="never"
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search services"
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
          )}

          <SectionHeading title="Quick access" />
          {loadState === "loading" ? <QuickAccessSkeleton columns={quickAccessColumns} /> : <QuickAccess services={quickAccessServices} columns={quickAccessColumns} onOpen={(service) => void openService(service)} />}

          <SectionHeading title="Categories" />
          {loadState === "loading" ? <CategorySkeleton /> : <CategoryFilter categories={categoryDefinitions} selectedCategory={selectedCategory} onSelect={setSelectedCategory} />}

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

          {loadState === "loading" ? <ServiceCatalogueSkeleton /> : loadState === "error" ? <ServiceLoadError message={loadError ?? "Unable to load services."} onRetry={() => void loadDirectory()} /> : <View style={styles.catalogueSection}>{groupedServices.map((section) => <ServiceSection key={section.title} title={section.title} services={section.services} resources={resources} favouriteIds={preferences.favouriteServiceIds} pendingFavouriteId={pendingFavouriteId} onOpen={(service) => void openService(service)} onToggleFavourite={(service) => void toggleServiceFavourite(service)} />)}{queryActive && filteredServices.length === 0 ? <SearchEmptyState onClear={() => { setQuery(""); setSelectedCategory("all"); }} /> : null}</View>}
        </View>
      </ScrollView>
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
    </SafeAreaView>
  );
}

function CategoryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Show ${label.toLowerCase()} services`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.categoryChip, selected && styles.categoryChipSelected, pressed && styles.pressed]}>
      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function CategoryFilter({ categories, selectedCategory, onSelect }: { categories: { id: ServiceCategoryId; shortTitle: string }[]; selectedCategory: ServiceCategoryId | "all"; onSelect: (category: ServiceCategoryId | "all") => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollViewport} contentContainerStyle={styles.categoryScroll}>
      <CategoryChip label="All" selected={selectedCategory === "all"} onPress={() => onSelect("all")} />
      {categories.map((category) => <CategoryChip key={category.id} label={category.shortTitle} selected={selectedCategory === category.id} onPress={() => onSelect(category.id)} />)}
    </ScrollView>
  );
}

function QuickAccess({ services, columns, onOpen }: { services: ServiceDefinition[]; columns: number; onOpen: (service: ServiceDefinition) => void }) {
  return (
    <View style={styles.quickAccessGrid}>
      {services.map((service) => (
        <Pressable
          key={service.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${service.title}`}
          onPress={() => onOpen(service)}
          style={({ pressed }) => [styles.quickAccessItem, { width: columns === 4 ? "23.5%" : "48%" }, pressed && styles.pressed]}
        >
          <ServiceIcon service={service} />
          <Text numberOfLines={1} style={styles.quickAccessLabel}>{quickAccessLabel(service)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function quickAccessLabel(service: ServiceDefinition): string {
  switch (service.id) {
    case "transfer-money": return "Transfer";
    case "scan-qr": return "Scan QR";
    case "my-cards": return "Cards";
    case "account-statements": return "Statements";
    default: return service.title;
  }
}

function QuickAccessSkeleton({ columns }: { columns: number }) {
  return <View style={styles.quickAccessGrid}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.quickAccessItem, styles.skeletonTile, { width: columns === 4 ? "23.5%" : "48%" }]}><View style={styles.skeletonQuickIcon} /><View style={styles.skeletonQuickLabel} /></View>)}</View>;
}

function CategorySkeleton() {
  return <View style={styles.categorySkeleton}>{[0, 1, 2, 3, 4].map((item) => <View key={item} style={[styles.skeletonChip, item === 0 && styles.skeletonChipWide]} />)}</View>;
}

function ServiceCatalogueSkeleton() {
  return <View style={styles.catalogueSection}>{serviceCategories.slice(0, 4).map((category) => <View key={category.id} style={styles.section}><View style={styles.skeletonSectionHeading} /><View style={styles.surfaceCard}>{[0, 1, 2].map((item) => <View key={item} style={[styles.skeletonServiceRow, item > 0 && styles.skeletonServiceDivider]}><View style={styles.skeletonServiceIcon} /><View style={styles.skeletonServiceCopy}><View style={styles.skeletonServiceTitle} /><View style={styles.skeletonServiceDescription} /></View><View style={styles.skeletonChevron} /></View>)}</View></View>)}</View>;
}

function ServiceSection({ title, services, resources, favouriteIds, pendingFavouriteId, onOpen, onToggleFavourite }: { title: string; services: ServiceDefinition[]; resources: Awaited<ReturnType<typeof loadDirectoryResources>> | null; favouriteIds: string[]; pendingFavouriteId: string | null; onOpen: (service: ServiceDefinition) => void; onToggleFavourite: (service: ServiceDefinition) => void }) {
  return (
    <View style={styles.section}>
      <SectionHeading title={title} />
      <View style={styles.surfaceCard}>
        {services.map((service, index) => <ServiceRow key={service.id} service={service} availability={availabilityFor(service, resources)} isFavourite={favouriteIds.includes(service.id)} isPendingFavourite={pendingFavouriteId === service.id} showDivider={index < services.length - 1} onPress={() => onOpen(service)} onToggleFavourite={() => onToggleFavourite(service)} />)}
      </View>
    </View>
  );
}

function ServiceLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.loadError} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={22} color={colors.danger} /><View style={styles.loadErrorCopy}><Text style={styles.loadErrorTitle}>Unable to load services</Text><Text style={styles.loadErrorDescription}>{message}</Text></View><Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
}

function SearchEmptyState({ onClear }: { onClear: () => void }) {
  return <View style={styles.noResultsCard} accessibilityLiveRegion="polite"><Ionicons name="search-outline" size={23} color={colors.muted} /><View style={styles.noResultsCopy}><Text style={styles.noResultsTitle}>No services found</Text><Text style={styles.noResultsDescription}>Try another search or browse by category.</Text></View><Pressable accessibilityRole="button" onPress={onClear} style={styles.clearResultsButton}><Text style={styles.clearResultsText}>Clear</Text></Pressable></View>;
}

function SectionHeading({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}><Text style={styles.sectionActionText}>{actionLabel}</Text></Pressable> : null}
    </View>
  );
}

function ServiceIcon({ service }: { service: ServiceDefinition }) {
  const iconColor = service.iconTone === "green" ? colors.green : colors.orange;
  const iconBackground = service.iconTone === "green" ? colors.greenSoft : colors.orangeSoft;
  return <View style={[styles.serviceIcon, { backgroundColor: iconBackground }]}>{service.icon.family === "material-community" ? <MaterialCommunityIcons name={service.icon.name} size={23} color={iconColor} /> : <Ionicons name={service.icon.name} size={23} color={iconColor} />}</View>;
}

function FavouriteButton({ service, isFavourite, isPending, onPress }: { service: ServiceDefinition; isFavourite: boolean; isPending: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${isFavourite ? "Remove" : "Add"} ${service.title} ${isFavourite ? "from" : "to"} favourites`} accessibilityState={{ busy: isPending, selected: isFavourite }} disabled={isPending} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.favouriteButton, pressed && styles.pressed]}><Ionicons name={isFavourite ? "star" : "star-outline"} size={18} color={isFavourite ? colors.green : colors.muted} /></Pressable>;
}

function ServiceRow({ service, availability, isFavourite, isPendingFavourite, showDivider, onPress, onToggleFavourite }: { service: ServiceDefinition; availability: ServiceAvailability; isFavourite: boolean; isPendingFavourite: boolean; showDivider: boolean; onPress: () => void; onToggleFavourite: () => void }) {
  const availabilityLabel = availability.state === "unavailable" ? "Unavailable" : availability.state === "checking" ? "Checking" : null;
  return (
    <View>
      <View style={styles.serviceRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${service.title}`} accessibilityHint={service.description} onPress={onPress} style={({ pressed }) => [styles.serviceRowMain, pressed && styles.pressed]}>
          <ServiceIcon service={service} />
          <View style={styles.serviceRowCopy}>
            <Text numberOfLines={1} style={styles.serviceRowTitle}>{service.title}</Text>
            <Text numberOfLines={2} style={styles.serviceRowDescription}>{service.description}</Text>
            {availabilityLabel ? <Text style={[styles.serviceRowStatus, availability.state === "unavailable" && styles.serviceRowStatusUnavailable]}>{availabilityLabel}</Text> : null}
          </View>
        </Pressable>
        <View style={styles.trailing}>
          {service.favouriteAllowed ? <FavouriteButton service={service} isFavourite={isFavourite} isPending={isPendingFavourite} onPress={onToggleFavourite} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${service.title}`} onPress={onPress} style={({ pressed }) => [styles.chevronButton, pressed && styles.pressed]}>
            <Ionicons name="chevron-forward" size={19} color={colors.muted} />
          </Pressable>
        </View>
      </View>
      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
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
  flex: { flex: 1 },
  fixedHeader: { backgroundColor: colors.background },
  content: { width: "100%", alignSelf: "center" },
  headerRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center" },
  backText: { marginLeft: 2, color: colors.text, fontSize: 16, fontWeight: "600" },
  helpButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8 },
  helpText: { color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  title: { ...appTypography.pageTitle, marginTop: 28, color: colors.text },
  subtitle: { ...appTypography.supporting, marginTop: 8, color: colors.secondary, fontSize: 15, lineHeight: 22 },
  searchContainer: { width: "100%", minHeight: 54, flexDirection: "row", alignItems: "center", marginTop: 24, paddingHorizontal: 15, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchSkeleton: { backgroundColor: colors.surfaceMuted },
  searchSkeletonIcon: { width: 21, height: 21, borderRadius: 11, backgroundColor: "#E7ECEE" },
  searchSkeletonLine: { flex: 1, height: 12, marginLeft: 10, borderRadius: 6, backgroundColor: "#E7ECEE" },
  searchContainerFocused: { borderColor: colors.green },
  searchInput: { flex: 1, minWidth: 0, marginLeft: 10, paddingVertical: 13, color: colors.text, fontSize: 15 },
  clearSearchButton: { minWidth: 32, minHeight: 44, alignItems: "center", justifyContent: "center" },
  quickAccessGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  quickAccessItem: { minHeight: 88, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, paddingVertical: 9, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  quickAccessLabel: { maxWidth: "100%", marginTop: 6, color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: "700", textAlign: "center" },
  categorySkeleton: { flexDirection: "row", columnGap: 8, overflow: "hidden", paddingTop: 4, paddingBottom: 2 },
  categoryScrollViewport: { marginHorizontal: -PAGE_GUTTER },
  categoryScroll: { columnGap: 8, paddingHorizontal: PAGE_GUTTER, paddingBottom: 2 },
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
  section: { width: "100%", marginTop: appSpacing.huge },
  catalogueSection: { width: "100%", marginTop: 0 },
  sectionHeading: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { ...appTypography.cardTitle, color: colors.text, fontSize: 20, lineHeight: 27, fontWeight: "700" },
  sectionAction: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8 },
  sectionActionText: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  surfaceCard: { width: "100%", overflow: "hidden", borderRadius: appRadii.card, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  serviceRow: { minHeight: 84, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  serviceRowMain: { flex: 1, minWidth: 0, minHeight: 68, flexDirection: "row", alignItems: "center" },
  serviceRowCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  serviceRowTitle: { ...appTypography.supporting, color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  serviceRowDescription: { ...appTypography.metadata, flexShrink: 1, marginTop: 3, color: colors.secondary, fontSize: 14, lineHeight: 19 },
  serviceRowStatus: { marginTop: 3, color: colors.orange, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  serviceRowStatusUnavailable: { color: colors.secondary },
  serviceIcon: { width: 45, height: 45, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 23 },
  trailing: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 4, flexShrink: 0 },
  favouriteButton: { minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" },
  chevronButton: { width: 24, height: 40, alignItems: "flex-end", justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 73, backgroundColor: colors.divider },
  noResultsCard: { minHeight: 68, flexDirection: "row", alignItems: "center", marginTop: 20, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  noResultsCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  noResultsTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  noResultsDescription: { marginTop: 3, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  clearResultsButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  clearResultsText: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  loadError: { minHeight: 72, flexDirection: "row", alignItems: "center", marginTop: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  loadErrorCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  loadErrorTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  loadErrorDescription: { marginTop: 2, color: colors.secondary, fontSize: 12, lineHeight: 17 },
  retryButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  retryText: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
  skeletonTile: { backgroundColor: colors.surfaceMuted },
  skeletonQuickIcon: { width: 45, height: 45, borderRadius: 23, backgroundColor: "#E7ECEE" },
  skeletonQuickLabel: { width: "58%", height: 10, marginTop: 8, borderRadius: 5, backgroundColor: "#E7ECEE" },
  skeletonChip: { width: 72, height: 36, borderRadius: 18, backgroundColor: "#E7ECEE" },
  skeletonChipWide: { width: 48 },
  skeletonSectionHeading: { width: 148, height: 22, marginTop: 4, marginBottom: 10, borderRadius: 11, backgroundColor: "#E7ECEE" },
  skeletonServiceRow: { minHeight: 88, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  skeletonServiceDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  skeletonServiceIcon: { width: 45, height: 45, borderRadius: 23, backgroundColor: "#E7ECEE" },
  skeletonServiceCopy: { flex: 1, marginLeft: 12 },
  skeletonServiceTitle: { width: "52%", height: 13, borderRadius: 7, backgroundColor: "#E7ECEE" },
  skeletonServiceDescription: { width: "78%", height: 10, marginTop: 8, borderRadius: 5, backgroundColor: "#EEF1F3" },
  skeletonChevron: { width: 20, height: 20, marginLeft: 12, borderRadius: 10, backgroundColor: "#EEF1F3" },
  secondaryButton: { minHeight: 44, justifyContent: "center", marginTop: 16, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.greenSoft },
  secondaryButtonText: { color: colors.greenDark, fontSize: 14, fontWeight: "700" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.38)" },
  modalCard: { maxHeight: "82%", padding: 20, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  modalHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  modalSubtitle: { marginTop: 3, color: colors.secondary, fontSize: 13 },
  modalOptionText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  resourceOption: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  resourceOptionCopy: { flex: 1 },
  resourceOptionSubtext: { marginTop: 3, color: colors.secondary, fontSize: 13 },
  pressed: { opacity: 0.72 },
});
