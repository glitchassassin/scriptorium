import type { ButtonHTMLAttributes } from "react";
import { useEffect, useState } from "react";

function callAll<Args extends Array<unknown>>(
  ...fns: Array<((...args: Args) => unknown) | undefined>
) {
  return (...args: Args) => fns.forEach((fn) => fn?.(...args));
}

export function useDoubleCheck(timeoutMs = 5000) {
  const [doubleCheck, setDoubleCheck] = useState(false);

  useEffect(() => {
    if (!doubleCheck) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDoubleCheck(false);
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [doubleCheck, timeoutMs]);

  function getButtonProps(props?: ButtonHTMLAttributes<HTMLButtonElement>) {
    const onBlur: ButtonHTMLAttributes<HTMLButtonElement>["onBlur"] = () => {
      setDoubleCheck(false);
    };
    const onClick: ButtonHTMLAttributes<HTMLButtonElement>["onClick"] = doubleCheck
      ? undefined
      : (event) => {
          event.preventDefault();
          setDoubleCheck(true);
        };
    const onKeyUp: ButtonHTMLAttributes<HTMLButtonElement>["onKeyUp"] = (event) => {
      if (event.key === "Escape") {
        setDoubleCheck(false);
      }
    };

    return {
      ...props,
      onBlur: callAll(onBlur, props?.onBlur),
      onClick: callAll(onClick, props?.onClick),
      onKeyUp: callAll(onKeyUp, props?.onKeyUp),
    };
  }

  return { doubleCheck, getButtonProps };
}
