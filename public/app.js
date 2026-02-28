const form = document.getElementById("card-form");
const health = document.getElementById("health");
const lanes = {
  todo: document.getElementById("todo"),
  doing: document.getElementById("doing"),
  done: document.getElementById("done")
};
const template = document.getElementById("card-template");

let cards = [];
let draggedCardId = null;

function groupedCards() {
  return {
    todo: cards.filter((card) => card.status === "todo"),
    doing: cards.filter((card) => card.status === "doing"),
    done: cards.filter((card) => card.status === "done")
  };
}

function insertEmptyState(lane) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "No cards yet";
  lane.append(empty);
}

function render() {
  const groups = groupedCards();

  Object.entries(lanes).forEach(([status, lane]) => {
    lane.textContent = "";
    const laneCards = groups[status];

    if (!laneCards.length) {
      insertEmptyState(lane);
      return;
    }

    laneCards
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .forEach((card) => {
        const node = template.content.firstElementChild.cloneNode(true);
        node.dataset.id = String(card.id);

        node.querySelector(".card-title").textContent = card.title;
        node.querySelector(".card-description").textContent = card.description || "No description";
        lane.append(node);
      });
  });
}

async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function loadCards() {
  cards = await request("/api/cards");
  render();
}

async function refreshHealth() {
  try {
    const status = await request("/api/health");
    health.textContent = status.ok ? "Database connected" : "Database unavailable";
  } catch {
    health.textContent = "Database unavailable";
  }
}

async function addCard(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status")
  };

  try {
    const card = await request("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    cards.push(card);
    form.reset();
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function updateCard(id, updates) {
  const updated = await request(`/api/cards/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });

  cards = cards.map((card) => (card.id === updated.id ? updated : card));
}

async function deleteCard(id) {
  await request(`/api/cards/${id}`, { method: "DELETE" });
  cards = cards.filter((card) => card.id !== id);
  render();
}

async function reorderLane(status) {
  const lane = lanes[status];
  const ids = Array.from(lane.querySelectorAll(".card"), (node) => Number(node.dataset.id));

  await request("/api/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, orderedIds: ids })
  });

  cards = cards.map((card) => {
    const index = ids.indexOf(card.id);
    if (index === -1) {
      return card;
    }

    return { ...card, status, position: index };
  });
}

function attachEvents() {
  form.addEventListener("submit", addCard);

  document.body.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("button[data-action]");
    if (!actionButton) {
      return;
    }

    const cardNode = actionButton.closest(".card");
    if (!cardNode) {
      return;
    }

    const id = Number(cardNode.dataset.id);

    if (actionButton.dataset.action === "delete") {
      if (confirm("Delete this card?")) {
        try {
          await deleteCard(id);
        } catch (error) {
          alert(error.message);
        }
      }
      return;
    }

    if (actionButton.dataset.action === "edit") {
      const current = cards.find((card) => card.id === id);
      const title = prompt("Edit title", current?.title || "");
      if (!title) {
        return;
      }

      const description = prompt("Edit description", current?.description || "") || "";
      try {
        await updateCard(id, { title, description });
        render();
      } catch (error) {
        alert(error.message);
      }
    }
  });

  Object.entries(lanes).forEach(([status, lane]) => {
    lane.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".card");
      if (!card) {
        return;
      }
      draggedCardId = Number(card.dataset.id);
      card.classList.add("dragging");
    });

    lane.addEventListener("dragend", (event) => {
      const card = event.target.closest(".card");
      if (card) {
        card.classList.remove("dragging");
      }
      draggedCardId = null;
      Object.values(lanes).forEach((item) => item.classList.remove("drag-over"));
    });

    lane.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("drag-over");
    });

    lane.addEventListener("dragleave", () => {
      lane.classList.remove("drag-over");
    });

    lane.addEventListener("drop", async (event) => {
      event.preventDefault();
      lane.classList.remove("drag-over");

      if (!draggedCardId) {
        return;
      }

      const draggedNode = document.querySelector(`.card[data-id="${draggedCardId}"]`);
      if (!draggedNode || !lane) {
        return;
      }

      lane.append(draggedNode);
      const sourceStatus = cards.find((card) => card.id === draggedCardId)?.status;

      try {
        await reorderLane(status);
        if (sourceStatus && sourceStatus !== status) {
          await reorderLane(sourceStatus);
        }
      } catch (error) {
        alert(error.message);
        await loadCards();
      }

      render();
    });
  });
}

attachEvents();
await refreshHealth();
await loadCards();
