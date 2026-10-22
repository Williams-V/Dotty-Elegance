document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector("header");
  const shopHeader = document.querySelector(".shop-header");
  const cartKey = "dotty-cart";
  const shopMessage = document.querySelector("#shop-message");
  const cartLink = document.querySelector("#cart-link");

  if (header) {
    header.classList.remove("header-start-hidden");
    header.classList.add("animate-fadeDown");
  }
  if (shopHeader) {
    shopHeader.classList.remove("shopheader-start-hidden");
    shopHeader.classList.add("animate-fadeIn");
  }

  document.querySelectorAll(".product-card").forEach((card, index) => {
    card.classList.add("product-start-hidden");
    window.setTimeout(() => {
      card.classList.remove("product-start-hidden");
      card.classList.add("animate-zoomIn");
    }, 180 + index * 120);
  });

  function showShopMessage(message, isError = false) {
    if (!shopMessage) {
      return;
    }
    shopMessage.textContent = message;
    shopMessage.classList.toggle("is-error", isError);
  }

  function productIdFromImage(imageUrl) {
    const fileName = new URL(imageUrl, window.location.href).pathname.split("/").pop();
    return decodeURIComponent(fileName)
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getCart() {
    try {
      const cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
      if (!Array.isArray(cart)) {
        throw new Error("Invalid basket data.");
      }
      return cart.filter(
        (item) =>
          item &&
          typeof item.productId === "string" &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= 20
      );
    } catch {
      showShopMessage("Your saved basket could not be read. Clear this browser's site data to start a new order.", true);
      return [];
    }
  }

  function updateCartCount() {
    const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
    if (cartLink) {
      cartLink.textContent = `My order (${count})`;
    }
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

  const filterButtons = Array.from(document.querySelectorAll(".filter-btn"));
  const products = document.querySelectorAll(".product-card");
  const categoryNotice = document.querySelector(".category-notice");

  function filterProducts(category) {
    filterButtons.forEach((button) => {
      const isActive = button.dataset.filter === category;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    products.forEach((product) => {
      product.hidden = category !== "all" && product.dataset.category !== category;
    });
    if (categoryNotice) {
      categoryNotice.hidden = category !== categoryNotice.dataset.category;
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => filterProducts(button.dataset.filter));
  });
  const initialCategory = window.location.hash.slice(1);
  const initialButton = filterButtons.find(
    (button) => button.dataset.filter === initialCategory
  );
  filterProducts(initialButton ? initialButton.dataset.filter : "all");
  updateCartCount();

  const productIds = [];
  document.querySelectorAll(".product-card").forEach((card) => {
    const productId = productIdFromImage(card.querySelector("img").src);
    productIds.push(productId);

    const actions = document.createElement("div");
    actions.className = "product-actions";
    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "favorite-toggle";
    favoriteButton.dataset.productId = productId;
    favoriteButton.setAttribute("aria-pressed", "false");
    favoriteButton.textContent = "♡ Save";
    favoriteButton.addEventListener("click", async () => {
      try {
        const { user } = await apiRequest("/api/auth/me");
        if (!user) {
          window.location.href = "account.html#signup";
          return;
        }

        const isSaved = favoriteButton.getAttribute("aria-pressed") === "true";
        await apiRequest(
          isSaved ? `/api/favorites/${encodeURIComponent(productId)}` : "/api/favorites",
          isSaved
            ? { method: "DELETE" }
            : { method: "POST", body: JSON.stringify({ productId }) }
        );
        favoriteButton.setAttribute("aria-pressed", String(!isSaved));
        favoriteButton.textContent = isSaved ? "♡ Save" : "♥ Saved";
        showShopMessage(isSaved ? "Favorite removed." : "Product saved to your favorites.");
      } catch (error) {
        showShopMessage(error.message, true);
      }
    });

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-to-order";
    addButton.textContent = "Add to order";
    addButton.addEventListener("click", () => {
      const cart = getCart();
      const existing = cart.find((item) => item.productId === productId);
      if (existing) {
        if (existing.quantity >= 20) {
          showShopMessage("You can order up to 20 of the same item at a time.", true);
          return;
        }
        existing.quantity += 1;
      } else {
        cart.push({ productId, quantity: 1 });
      }
      try {
        localStorage.setItem(cartKey, JSON.stringify(cart));
        updateCartCount();
        showShopMessage(`${card.querySelector("h4").textContent.trim()} added to your order.`);
      } catch {
        showShopMessage("Your basket could not be saved in this browser. Check your browser storage settings.", true);
      }
    });
    actions.append(favoriteButton, addButton);
    card.querySelector(".product-info").append(actions);
  });

  if (productIds.length) {
    apiRequest("/api/auth/me")
      .then(({ user }) => {
        if (!user) {
          return null;
        }
        return apiRequest("/api/favorites");
      })
      .then((data) => {
        if (!data) {
          return;
        }
        const savedIds = new Set(data.favorites.map((favorite) => favorite.id));
        document.querySelectorAll(".favorite-toggle").forEach((button) => {
          const isSaved = savedIds.has(button.dataset.productId);
          button.setAttribute("aria-pressed", String(isSaved));
          button.textContent = isSaved ? "♥ Saved" : "♡ Save";
        });
      })
      .catch((error) => showShopMessage(error.message, true));
  }
});
