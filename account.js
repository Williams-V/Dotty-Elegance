document.addEventListener("DOMContentLoaded", async () => {
  const authPanel = document.querySelector("#auth-panel");
  const dashboard = document.querySelector("#dashboard");
  const loginForm = document.querySelector("#login-form");
  const signupForm = document.querySelector("#signup-form");
  const resetPanel = document.querySelector("#reset-request-form");
  const connectionMessage = document.querySelector("#connection-message");
  const accountMessage = document.querySelector("#account-message");
  const money = new Intl.NumberFormat("en-KE");
  let currentUser = null;
  let authMode = window.location.hash === "#signup" ? "signup" : "login";

  function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
  }

  function showAuthForm(mode) {
    authMode = mode;
    loginForm.hidden = mode !== "login";
    signupForm.hidden = mode !== "signup";
    resetPanel.hidden = mode !== "reset-request";
    const titles = {
      login: "Welcome back",
      signup: "Create your account",
      "reset-request": "Password help"
    };
    document.querySelector("#auth-title").textContent = titles[mode];
  }

  async function apiRequest(route, options = {}) {
    const response = await fetch(route, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "The request could not be completed.");
    }
    return data;
  }

  function getCart() {
    try {
      const saved = JSON.parse(localStorage.getItem("dotty-cart") || "[]");
      if (!Array.isArray(saved)) {
        throw new Error("The saved order is invalid.");
      }
      return saved.filter(
        (item) =>
          item &&
          typeof item.productId === "string" &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= 20
      );
    } catch {
      showMessage(accountMessage, "Your saved basket could not be read. Please add your items again.", true);
      return [];
    }
  }

  function makeEmptyMessage(message) {
    const paragraph = document.createElement("p");
    paragraph.className = "empty-message";
    paragraph.textContent = message;
    return paragraph;
  }

  async function renderCart() {
    const container = document.querySelector("#cart-items");
    const totalElement = document.querySelector("#cart-total");
    const checkoutForm = document.querySelector("#checkout-form");
    const cart = getCart();
    container.replaceChildren();
    totalElement.textContent = "";
    checkoutForm.hidden = cart.length === 0;
    if (!cart.length) {
      container.append(makeEmptyMessage("Your basket is empty. Browse the shop to add products."));
      return;
    }

    const { products } = await apiRequest("/api/products");
    const productMap = new Map(products.map((product) => [product.id, product]));
    let total = 0;
    for (const item of cart) {
      const product = productMap.get(item.productId);
      if (!product) {
        continue;
      }
      total += product.priceKes * item.quantity;
      const row = document.createElement("div");
      row.className = "cart-row";
      const description = document.createElement("p");
      description.textContent =
        `${product.name} · ${item.quantity} × KSh ${money.format(product.priceKes)}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        localStorage.setItem(
          "dotty-cart",
          JSON.stringify(cart.filter((entry) => entry.productId !== item.productId))
        );
        renderCart().catch((error) => showMessage(accountMessage, error.message, true));
      });
      row.append(description, remove);
      container.append(row);
    }

    if (!productMap.size || total === 0) {
      container.replaceChildren(
        makeEmptyMessage("These products are no longer available. Please update your basket from the shop.")
      );
      checkoutForm.hidden = true;
      return;
    }
    totalElement.textContent = `Estimated total: KSh ${money.format(total)}`;
  }

  async function renderFavorites() {
    const container = document.querySelector("#favorite-items");
    const { favorites } = await apiRequest("/api/favorites");
    container.replaceChildren();
    if (!favorites.length) {
      container.append(makeEmptyMessage("You have not saved any favorites yet."));
      return;
    }
    favorites.forEach((product) => {
      const row = document.createElement("article");
      row.className = "favorite-card";
      const image = document.createElement("img");
      image.src = product.imageUrl;
      image.alt = product.name;
      const details = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = product.name;
      const price = document.createElement("p");
      price.textContent = `KSh ${money.format(product.priceKes)}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button";
      remove.textContent = "Remove favorite";
      remove.addEventListener("click", async () => {
        try {
          await apiRequest(`/api/favorites/${encodeURIComponent(product.id)}`, {
            method: "DELETE"
          });
          await renderFavorites();
          showMessage(accountMessage, "Favorite removed.");
        } catch (error) {
          showMessage(accountMessage, error.message, true);
        }
      });
      details.append(name, price, remove);
      row.append(image, details);
      container.append(row);
    });
  }

  async function renderOrders() {
    const container = document.querySelector("#order-history");
    const { orders } = await apiRequest("/api/orders");
    container.replaceChildren();
    if (!orders.length) {
      container.append(makeEmptyMessage("Your order history will appear here after your first order."));
      return;
    }
    orders.forEach((order) => {
      const card = document.createElement("article");
      card.className = "order-card";
      const heading = document.createElement("h3");
      heading.textContent = `Order ${order.id.slice(0, 8).toUpperCase()}`;
      const status = document.createElement("p");
      status.className = "order-status";
      status.textContent = `Status: ${order.status.replaceAll("_", " ")}`;
      const date = document.createElement("p");
      date.textContent = `Placed ${new Date(`${order.createdAt}Z`).toLocaleString()}`;
      const items = document.createElement("ul");
      order.items.forEach((item) => {
        const line = document.createElement("li");
        line.textContent =
          `${item.productName} × ${item.quantity} — KSh ${money.format(item.unitPriceKes * item.quantity)}`;
        items.append(line);
      });
      const total = document.createElement("p");
      total.className = "cart-total";
      total.textContent = `Total: KSh ${money.format(order.totalKes)}`;
      const address = document.createElement("p");
      address.textContent = `Delivery to: ${order.deliveryAddress}`;
      card.append(heading, status, date, items, total, address);
      container.append(card);
    });
  }

  async function renderDashboard(user) {
    currentUser = user;
    authPanel.hidden = Boolean(user);
    dashboard.hidden = !user;
    if (!user) {
      showAuthForm(authMode);
      return;
    }
    document.querySelector("#account-email").textContent = user.email;
    document.querySelector("#profile-name").value = user.fullName;
    document.querySelector("#profile-phone").value = user.phone;
    document.querySelector("#profile-address").value = user.deliveryAddress;
    document.querySelector("#admin-link").hidden = user.role !== "store_admin";
    await Promise.all([renderCart(), renderFavorites(), renderOrders()]);
  }

  async function handleAuthSubmit(form, endpoint, body) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    showMessage(connectionMessage, endpoint.endsWith("login") ? "Signing in…" : "Creating your account…");
    try {
      const { user } = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });
      showMessage(connectionMessage, "");
      await renderDashboard(user);
    } catch (error) {
      showMessage(connectionMessage, error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  if (window.location.hash === "#signup") {
    showAuthForm("signup");
  }
  document.querySelectorAll("[data-show-signup]").forEach((button) => {
    button.addEventListener("click", () => showAuthForm("signup"));
  });
  document.querySelectorAll("[data-show-login]").forEach((button) => {
    button.addEventListener("click", () => showAuthForm("login"));
  });
  document.querySelectorAll("[data-reset-password]").forEach((button) => {
    button.addEventListener("click", () => showAuthForm("reset-request"));
  });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuthSubmit(loginForm, "/api/auth/login", {
      email: document.querySelector("#login-email").value.trim(),
      password: document.querySelector("#login-password").value
    });
  });

  signupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuthSubmit(signupForm, "/api/auth/register", {
      fullName: document.querySelector("#signup-name").value.trim(),
      phone: document.querySelector("#signup-phone").value.trim(),
      email: document.querySelector("#signup-email").value.trim(),
      password: document.querySelector("#signup-password").value
    });
  });

  document.querySelector("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const { user } = await apiRequest("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: document.querySelector("#profile-name").value.trim(),
          phone: document.querySelector("#profile-phone").value.trim(),
          deliveryAddress: document.querySelector("#profile-address").value.trim()
        })
      });
      currentUser = user;
      showMessage(accountMessage, "Your profile has been saved.");
    } catch (error) {
      showMessage(accountMessage, error.message, true);
    }
  });

  document.querySelector("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentPassword = document.querySelector("#current-password").value;
    const newPassword = document.querySelector("#new-password").value;
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await apiRequest("/api/account/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      document.querySelector("#password-form").reset();
      currentUser = null;
      dashboard.hidden = true;
      authPanel.hidden = false;
      showAuthForm("login");
      showMessage(connectionMessage, "Password updated. Please sign in again.");
    } catch (error) {
      showMessage(accountMessage, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#checkout-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) {
      showMessage(accountMessage, "Sign in before placing an order.", true);
      return;
    }
    const items = getCart();
    if (!items.length) {
      showMessage(accountMessage, "Add at least one product before placing an order.", true);
      return;
    }
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    showMessage(accountMessage, "Submitting your order…");
    try {
      const { orderId } = await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items,
          deliveryAddress: currentUser.deliveryAddress,
          contactPhone: currentUser.phone
        })
      });
      localStorage.removeItem("dotty-cart");
      showMessage(
        accountMessage,
        `Order ${orderId.slice(0, 8).toUpperCase()} placed. The store will confirm your order and delivery.`
      );
      await Promise.all([renderCart(), renderOrders()]);
    } catch (error) {
      showMessage(accountMessage, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#sign-out-button").addEventListener("click", async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      await renderDashboard(null);
      showMessage(connectionMessage, "You have signed out.");
    } catch (error) {
      showMessage(accountMessage, error.message, true);
    }
  });

  try {
    const { user } = await apiRequest("/api/auth/me");
    await renderDashboard(user);
  } catch (error) {
    showMessage(
      connectionMessage,
      `${error.message} Check that the Dotty Elegance server is running, then reload this page.`,
      true
    );
  }
});
