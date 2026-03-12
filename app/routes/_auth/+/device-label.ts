export function getFallbackDeviceLabel() {
  if (typeof navigator === "undefined") {
    return "Unnamed device";
  }

  const userAgent = navigator.userAgent;
  const platform = /iPhone/i.test(userAgent)
    ? "iPhone"
    : /iPad/i.test(userAgent)
      ? "iPad"
      : /Android/i.test(userAgent)
        ? "Android"
        : /Mac/i.test(userAgent)
          ? "Mac"
          : /Windows/i.test(userAgent)
            ? "Windows"
            : /Linux/i.test(userAgent)
              ? "Linux"
              : null;
  const browser = /Edg/i.test(userAgent)
    ? "Edge"
    : /Chrome|CriOS/i.test(userAgent)
      ? "Chrome"
      : /Firefox|FxiOS/i.test(userAgent)
        ? "Firefox"
        : /Safari/i.test(userAgent) && !/Chrome|CriOS|Edg/i.test(userAgent)
          ? "Safari"
          : null;

  if (platform && browser) {
    return `${browser} on ${platform}`;
  }

  if (platform) {
    return `${platform} device`;
  }

  if (browser) {
    return `${browser} device`;
  }

  return "Unnamed device";
}
