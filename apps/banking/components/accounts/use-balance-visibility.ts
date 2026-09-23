import { useEffect, useState } from "react";

import {
  getBalanceVisibility,
  subscribeBalanceVisibility,
} from "@/services/accounts-service";

export function useBalanceVisibility(customerId: string, enabled = true) {
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [isBalanceVisibilityHydrated, setIsBalanceVisibilityHydrated] = useState(false);
  const [stateCustomerId, setStateCustomerId] = useState(customerId);

  useEffect(() => {
    let active = true;
    let hasReceivedUpdate = false;
    setBalanceVisible((current) => current ? false : current);
    setIsBalanceVisibilityHydrated((current) => current ? false : current);

    if (!enabled) return () => { active = false; };

    const applyVisibility = (visible: boolean) => {
      if (!active) return;
      setStateCustomerId((current) => current === customerId ? current : customerId);
      setBalanceVisible((current) => current === visible ? current : visible);
      setIsBalanceVisibilityHydrated((current) => current ? current : true);
    };
    const unsubscribe = subscribeBalanceVisibility((visible) => {
      hasReceivedUpdate = true;
      applyVisibility(visible);
    }, { customerId });

    void getBalanceVisibility({ customerId })
      .then((visible) => {
        if (!hasReceivedUpdate) applyVisibility(visible);
      })
      .catch(() => {
        if (!hasReceivedUpdate) applyVisibility(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [customerId, enabled]);

  const isCurrentCustomer = stateCustomerId === customerId;
  return {
    balanceVisible: isCurrentCustomer ? balanceVisible : false,
    isBalanceVisibilityHydrated: isCurrentCustomer ? isBalanceVisibilityHydrated : false,
  };
}
