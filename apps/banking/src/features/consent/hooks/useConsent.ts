import { useConsentContext } from "@/src/features/consent/state/ConsentProvider";

export function useConsent() {
  const context = useConsentContext();
  const { categories } = context.state;

  return {
    ...context,
    requiredCategories: categories.filter((category) => category.required),
    optionalCategories: categories.filter((category) => !category.required),
    selectedCategories: categories.filter((category) => category.selected),
    declinedCategories: categories.filter((category) => !category.selected),
  };
}
