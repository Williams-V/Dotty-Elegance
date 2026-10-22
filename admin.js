document.addEventListener("DOMContentLoaded", async () => {
  const message = document.querySelector("#admin-message");
  const ordersContainer = document.querySelector("#admin-orders");
  const signInLink = document.querySelector("#admin-signin-link");
  const money = new Intl.NumberFormat("en-KE");
  const statuses = [
    "pending",
    "confirmed",
    "preparing",
    "ready_for_delivery",
    "shipped",
    "delivered",
    "cancelled"
  ];

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
  }

  function makeText(tagName, text) {
    const element = document.createElement(tagName);
    element.textContent = text;
    return element;
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

  async function loadOrders() {
    showMessage("Loading orders…");
    const { orders } = await apiRequest("/api/admin/orders");
    ordersContainer.replaceChildren();
    if (!orders.length) {
      ordersContainer.append(makeText("p", "There are no orders yet."));
      ordersContainer.hidden = false;
      showMessage("Order management is ready.");
      return;
    }

    orders.forEach((order) => {
      const card = document.createElement("article");
      card.className = "order-card admin-order-card";
      card.append(
        makeText("h2", `Order ${order.id.slice(0, 8).toUpperCase()}`),
        makeText("p", `Customer: ${order.customerName} (${order.customerEmail})`),
        makeText("p", `Phone: ${order.contactPhone}`),
        makeText("p", `Delivery address: ${order.deliveryAddress}`),
        makeText("p", `Placed: ${new Date(`${order.createdAt}Z`).toLocaleString()}`)
      );
      const items = document.createElement("ul");
      order.items.forEach((item) => {
        items.append(
          makeText(
            "li",
            `${item.productName} × ${item.quantity} — KSh ${money.format(item.unitPriceKes * item.quantity)}`
          )
        );
      });
      card.append(items, makeText("p", `Total: KSh ${money.format(order.totalKes)}`));

      const form = document.createElement("form");
      form.className = "status-form";
      const label = document.createElement("label");
      const select = document.createElement("select");
      select.id = `status-${order.id}`;
      label.htmlFor = select.id;
      label.textContent = "Order status";
      statuses.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status.replaceAll("_", " ");
        option.selected = status === order.status;
        select.append(option);
      });
      const save = document.createElement("button");
      save.type = "submit";
      save.className = "primary-button";
      save.textContent = "Update status";
      form.append(label, select, save);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        save.disabled = true;
        try {
          await apiRequest(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: select.value })
          });
          showMessage(`Order ${order.id.slice(0, 8).toUpperCase()} updated.`);
        } catch (error) {
          showMessage(error.message, true);
        } finally {
          save.disabled = false;
        }
      });
      card.append(form);
      ordersContainer.append(card);
    });
    ordersContainer.hidden = false;
    showMessage(`${orders.length} order${orders.length === 1 ? "" : "s"} loaded.`);
  }

  try {
    const { user } = await apiRequest("/api/auth/me");
    if (!user) {
      showMessage("Sign in with the store administrator account to manage orders.");
      signInLink.hidden = false;
      return;
    }
    if (user.role !== "store_admin") {
      showMessage("This account is not authorized to manage store orders.", true);
      return;
    }
    await loadOrders();
  } catch (error) {
    showMessage(
      `${error.message} Check that the Dotty Elegance server is running, then reload this page.`,
      true
    );
  }
});
