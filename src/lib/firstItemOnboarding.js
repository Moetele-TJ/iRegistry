/** Session flag set once after login — triggers the first-item welcome modal. */
export const POST_LOGIN_WELCOME_KEY = "ireg_post_login_welcome";

export function markPostLoginWelcome() {
  try {
    sessionStorage.setItem(POST_LOGIN_WELCOME_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumePostLoginWelcome() {
  try {
    const v = sessionStorage.getItem(POST_LOGIN_WELCOME_KEY) === "1";
    if (v) sessionStorage.removeItem(POST_LOGIN_WELCOME_KEY);
    return v;
  } catch {
    return false;
  }
}

export function peekPostLoginWelcome() {
  try {
    return sessionStorage.getItem(POST_LOGIN_WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}
