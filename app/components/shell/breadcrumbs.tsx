import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

export type AppBreadcrumb = {
  content: ReactNode;
  to?: string;
};

type BreadcrumbsRegistration = {
  depth: number;
  id: string;
  items: AppBreadcrumb[];
  mountOrder: number;
};

type BreadcrumbsRegistryContextValue = {
  register: (registration: Omit<BreadcrumbsRegistration, "mountOrder">) => () => void;
};

const BreadcrumbsRegistryContext = createContext<BreadcrumbsRegistryContextValue | null>(null);
const ActiveBreadcrumbsContext = createContext<AppBreadcrumb[]>([]);

type BreadcrumbsItemProps = {
  children: ReactNode;
  to?: string;
};

function BreadcrumbsItem(_: BreadcrumbsItemProps) {
  return null;
}

function isBreadcrumbsItemElement(
  child: ReactNode,
): child is ReactElement<BreadcrumbsItemProps, typeof BreadcrumbsItem> {
  return isValidElement(child) && child.type === BreadcrumbsItem;
}

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const mountOrderRef = useRef(0);
  const [registrations, setRegistrations] = useState<BreadcrumbsRegistration[]>([]);

  const registryValue = useMemo<BreadcrumbsRegistryContextValue>(() => ({
    register(registration) {
      const mountOrder = mountOrderRef.current++;

      setRegistrations((current) => [
        ...current.filter((entry) => entry.id !== registration.id),
        { ...registration, mountOrder },
      ]);

      return () => {
        setRegistrations((current) => current.filter((entry) => entry.id !== registration.id));
      };
    },
  }), []);

  const activeItems = useMemo(() => {
    const activeRegistration = registrations.reduce<BreadcrumbsRegistration | null>((best, current) => {
      if (!best) {
        return current;
      }

      if (current.depth !== best.depth) {
        return current.depth > best.depth ? current : best;
      }

      return current.mountOrder > best.mountOrder ? current : best;
    }, null);

    return activeRegistration?.items ?? [];
  }, [registrations]);

  return (
    <BreadcrumbsRegistryContext.Provider value={registryValue}>
      <ActiveBreadcrumbsContext.Provider value={activeItems}>{children}</ActiveBreadcrumbsContext.Provider>
    </BreadcrumbsRegistryContext.Provider>
  );
}

type BreadcrumbsProps = {
  children: ReactNode;
  depth: number;
};

type BreadcrumbsComponent = ((props: BreadcrumbsProps) => null) & {
  Item: typeof BreadcrumbsItem;
};

const BreadcrumbsRoot = ({ children, depth }: BreadcrumbsProps) => {
  const context = useContext(BreadcrumbsRegistryContext);
  const id = useId();
  const items = useMemo<AppBreadcrumb[]>(() => Children.toArray(children).flatMap((child) => {
    if (!isBreadcrumbsItemElement(child)) {
      return [];
    }

    return [{
      content: child.props.children,
      ...(child.props.to ? { to: child.props.to } : {}),
    }];
  }), [children]);

  useEffect(() => {
    if (!context) {
      throw new Error("Breadcrumbs must be used within a BreadcrumbsProvider.");
    }

    return context.register({ depth, id, items });
  }, [context, depth, id, items]);

  return null;
};

export const Breadcrumbs = Object.assign(BreadcrumbsRoot, {
  Item: BreadcrumbsItem,
}) satisfies BreadcrumbsComponent;

export function useBreadcrumbs() {
  return useContext(ActiveBreadcrumbsContext);
}
