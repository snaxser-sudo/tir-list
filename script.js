(function () {
  "use strict";

  var TIER_DEFS = [
    { id: "S", title: "Основной фокус", limit: 1 },
    { id: "A", title: "Делаем следом", limit: 3 },
    { id: "B", title: "Стоит не забыть", limit: null },
    { id: "C", title: "Делаем в последнюю очередь", limit: null }
  ];

  var STORAGE_KEY = "tier-list-draft-v2";
  var DATA_KEY = "data";
  var MAX_TITLE_LENGTH = 500;
  var MOBILE_BREAKPOINT = 720;
  var DEFAULT_ITEM_TITLE = "Без названия";
  var DEFAULT_LOWEST_PRIORITY_ITEMS = [
    "Соковыжималка в клиентских путях. Клиентский путь никогда не должен заканчиваться. Должны быть постоянно в продаже. Чтобы он не оканчивался после оплаты",
    "Методология сравнения нас с Яндексом, но глазами пользователя. Где у него больше предложение из тех объектов размещения, чем он готов воспользоваться.",
    "Лучше авиацентра, лучше авиасейлс",
    "Забрать кусок оффлайна. Гипотеза - через офисы Альфы",
    "Половина тревел-кошелька",
    "Списание денег напрямую со счёта в АТ. Решается в основном через Альфу. - это не надо. стоит еще поговорить с Алиной и оценить целесообразность",
    "Стать на голову лучше, чем конкуренты в поддержке",
    "Управление пассажирами и попутчиками, очень нужно для Альфа Тревела",
    "Выступления на конференциях по ИИ",
    "Каждому пассажиру - отель",
    "Качество поиска повысить",
    "Авиа - ответственные заказчики у команды отелей",
    "Наша поддержка - супер-крутое преимущество, которое можно продавать",
    "Конкретный тур вместе с CRM предлагать людям",
    "Партнёрство с Билайн",
    "Публикации в Хабре и технологических сообщетсвах",
    "Взять в управление ОКР по активной клиентской базе: количество клиентов с двумя и тремя продуктами, проникноверие продаж отелей в пассажиров",
    "Подключение новых поставщиков за 1-2 месяца",
    "Как мы внедряемся в клиентские пути наших пассажиров",
    "Защита от хакерских атак/взлома",
    "Настроить работу с Альфа Тревелом: что делается у нас, что делается на стороне банка",
    "Подключить Хотелбук, Авиацентр, Академ Серис, Lebel Travel, MTK",
    "Стандарт рабочего места LLM у наших сотрудников. Разработано рабочее место и установлено",
    "Продающий КЦ",
    "Сделать классное ранжирование",
    "Онбординг и экран поездки."
  ];

  var state = createInitialState();
  var dragItemId = null;
  var moveSheetItemId = null;
  var statusTimer = 0;

  var board = document.getElementById("tier-board");
  var status = document.getElementById("status");
  var addForm = document.getElementById("add-form");
  var titleInput = document.getElementById("item-title");
  var shareButton = document.getElementById("share-button");
  var resetButton = document.getElementById("reset-button");

  bindEvents();
  loadInitialState();

  function bindEvents() {
    addForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addItem(titleInput.value);
    });

    resetButton.addEventListener("click", function () {
      resetTierList();
    });

    shareButton.addEventListener("click", function () {
      shareTierList();
    });

    board.addEventListener("click", function (event) {
      var deleteButton = event.target.closest("[data-action='delete-item']");
      if (!deleteButton) {
        return;
      }

      deleteItem(deleteButton.dataset.itemId);
    });

    board.addEventListener("click", function (event) {
      var moveButton = event.target.closest("[data-action='move-item']");
      if (!moveButton) {
        return;
      }

      event.preventDefault();
      openMoveSheet(moveButton.dataset.itemId);
    });

    board.addEventListener("click", function (event) {
      var card = event.target.closest(".item-card");

      if (!card || !isMobileLayout() || event.target.closest("button")) {
        return;
      }

      if (event.target.classList.contains("card-title") && !event.target.readOnly) {
        return;
      }

      event.preventDefault();
      openMoveSheet(card.dataset.itemId);
    });

    board.addEventListener("focusout", function (event) {
      if (!event.target.classList.contains("card-title") || !isMobileLayout()) {
        return;
      }

      event.target.readOnly = true;
    });

    board.addEventListener("change", function (event) {
      if (!event.target.classList.contains("card-title")) {
        return;
      }

      renameItem(event.target.dataset.itemId, event.target.value);
    });

    board.addEventListener("input", function (event) {
      if (!event.target.classList.contains("card-title")) {
        return;
      }

      resizeTextarea(event.target);
      renameItem(event.target.dataset.itemId, event.target.value, {
        clearShareHash: true,
        silent: true,
        skipRender: true
      });
    });

    board.addEventListener("dragstart", function (event) {
      var card = event.target.closest(".item-card");
      if (!card) {
        return;
      }

      dragItemId = card.dataset.itemId;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragItemId);
    });

    board.addEventListener("dragend", function (event) {
      var card = event.target.closest(".item-card");
      if (card) {
        card.classList.remove("is-dragging");
      }
      clearDropHighlights();
      dragItemId = null;
    });

    board.addEventListener("dragover", function (event) {
      var zone = event.target.closest(".items-zone");
      if (!zone) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDropHighlights(zone);
      zone.classList.add("is-over");
    });

    board.addEventListener("dragleave", function (event) {
      var zone = event.target.closest(".items-zone");
      if (!zone || zone.contains(event.relatedTarget)) {
        return;
      }
      zone.classList.remove("is-over");
    });

    board.addEventListener("drop", function (event) {
      var zone = event.target.closest(".items-zone");
      if (!zone) {
        return;
      }

      event.preventDefault();
      clearDropHighlights();
      var itemId = event.dataTransfer.getData("text/plain") || dragItemId;
      moveItem(itemId, zone.dataset.tierId);
    });

    window.addEventListener("hashchange", function () {
      var encoded = getHashData();
      if (encoded) {
        loadStateFromUrl(encoded);
      }
    });

    document.addEventListener("click", function (event) {
      var button = event.target.closest("[data-move-target]");
      var moved;

      if (!button) {
        return;
      }

      moved = moveItem(moveSheetItemId, button.dataset.moveTarget);
      if (moved) {
        closeMoveSheet();
      }
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-action='close-feedback-dialog']")) {
        return;
      }

      closeFeedbackDialog();
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-action='close-move-sheet']")) {
        return;
      }

      closeMoveSheet();
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-action='edit-card-text']")) {
        return;
      }

      enableMobileEditing(moveSheetItemId);
      closeMoveSheet();
    });

    window.addEventListener("resize", function () {
      updateCardEditMode();
    });
  }

  function loadInitialState() {
    var encodedFromUrl = getHashData();

    if (encodedFromUrl) {
      loadStateFromUrl(encodedFromUrl);
      return;
    }

    var draft = readDraft();
    if (draft) {
      var draftState = decodeState(draft);
      if (draftState && commitState(draftState, { persist: false, silent: true })) {
        showStatus("Черновик восстановлен");
        return;
      }
      removeDraft();
    }

    commitState(createInitialState(), { persist: false, silent: true });
  }

  function loadStateFromUrl(encoded) {
    var importedState = decodeState(encoded);
    if (importedState && commitState(importedState, { persist: false, silent: true })) {
      showStatus("Загружено из публичной ссылки");
      return;
    }

    commitState(createInitialState(), { persist: false, silent: true });
    showStatus("Не удалось прочитать ссылку, открыт пустой tier list", "error");
  }

  function addItem(rawTitle) {
    var title = normalizeTitle(rawTitle);
    var nextState = cloneState(state);
    var targetTier = getTier(nextState, "C");

    targetTier.items.push({
      id: createId(),
      title: title
    });

    if (commitState(nextState, { clearShareHash: true })) {
      titleInput.value = "";
      titleInput.focus();
      showStatus("Карточка добавлена");
    }
  }

  function renameItem(itemId, rawTitle, options) {
    var settings = options || { clearShareHash: true };
    var nextState = cloneState(state);
    var foundItem = findItem(nextState, itemId);

    if (!foundItem) {
      return;
    }

    foundItem.item.title = normalizeTitle(rawTitle);
    if (commitState(nextState, settings) && !settings.silent) {
      showStatus("Карточка переименована");
    }
  }

  function deleteItem(itemId) {
    var nextState = cloneState(state);
    var foundItem = findItem(nextState, itemId);

    if (!foundItem) {
      return;
    }

    foundItem.tier.items.splice(foundItem.index, 1);
    if (commitState(nextState, { clearShareHash: true })) {
      showStatus("Карточка удалена");
    }
  }

  function moveItem(itemId, targetTierId) {
    if (!itemId || !targetTierId) {
      return false;
    }

    var currentItem = findItem(state, itemId);
    if (!currentItem) {
      return false;
    }

    if (currentItem.tier.id === targetTierId) {
      return true;
    }

    var nextState = cloneState(state);
    var nextItem = findItem(nextState, itemId);
    var targetTier = getTier(nextState, targetTierId);

    if (!nextItem || !targetTier) {
      return false;
    }

    var item = nextItem.tier.items.splice(nextItem.index, 1)[0];
    targetTier.items.push(item);

    if (commitState(nextState, { clearShareHash: true, popupOnError: true })) {
      showStatus("Карточка перемещена");
      return true;
    }

    return false;
  }

  function resetTierList() {
    if (commitState(createInitialState(), { persist: false, clearShareHash: true })) {
      removeDraft();
      showStatus("Tier list сброшен");
    }
  }

  function shareTierList() {
    var encoded = encodeState(state);
    var shareUrl = writeShareHash(encoded);

    if (navigator.share && isMobileLayout()) {
      navigator.share({
        title: "Приоритеты на Q2",
        url: shareUrl
      }).then(function () {
        showStatus("Ссылка отправлена");
      }, function () {
        copyShareUrl(shareUrl);
      });
      return;
    }

    copyShareUrl(shareUrl);
  }

  function copyShareUrl(shareUrl) {
    copyText(shareUrl).then(function (copied) {
      showStatus(copied ? "Ссылка скопирована" : "Ссылка создана в адресной строке");
    });
  }

  function commitState(nextState, options) {
    var settings = options || {};
    var normalizedState;

    try {
      normalizedState = normalizeState(nextState);
    } catch (error) {
      if (!settings.silent) {
        showStatus("Не удалось применить состояние", "error");
      }
      return false;
    }

    var validation = validateState(normalizedState);
    if (!validation.ok) {
      if (!settings.silent) {
        showStatus(validation.message, "error");
        if (settings.popupOnError) {
          showFeedbackDialog(validation.message);
        }
      }
      return false;
    }

    state = normalizedState;

    if (settings.clearShareHash) {
      clearShareHash();
    }

    if (!settings.skipRender) {
      render();
    }

    if (settings.persist !== false) {
      saveDraft();
    }

    return true;
  }

  function normalizeState(inputState) {
    if (!inputState || !Array.isArray(inputState.tiers)) {
      throw new Error("Invalid state");
    }

    var seenIds = {};

    return {
      tiers: TIER_DEFS.map(function (definition) {
        var incomingTier = inputState.tiers.find(function (tier) {
          return tier && tier.id === definition.id;
        });
        var incomingItems = incomingTier && Array.isArray(incomingTier.items)
          ? incomingTier.items
          : [];
        var legacyD = inputState.tiers.find(function (tier) {
          return tier && tier.id === "D";
        });

        if (definition.id === "C" && legacyD && Array.isArray(legacyD.items)) {
          incomingItems = incomingItems.concat(legacyD.items);
        }

        return {
          id: definition.id,
          title: definition.title,
          limit: definition.limit,
          items: incomingItems.map(function (item) {
            var title = typeof item === "string" ? item : item && item.title;
            var id = item && typeof item.id === "string" ? item.id : "";
            id = normalizeId(id);

            if (!id || seenIds[id]) {
              id = createId();
            }
            seenIds[id] = true;

            return {
              id: id,
              title: normalizeTitle(title)
            };
          })
        };
      })
    };
  }

  function validateState(candidateState) {
    if (!candidateState || !Array.isArray(candidateState.tiers)) {
      return { ok: false, message: "Некорректное состояние tier list" };
    }

    for (var index = 0; index < TIER_DEFS.length; index += 1) {
      var definition = TIER_DEFS[index];
      var tier = candidateState.tiers[index];

      if (!tier || tier.id !== definition.id || !Array.isArray(tier.items)) {
        return { ok: false, message: "Некорректное состояние tier list" };
      }

      if (tier.limit !== null && tier.items.length > tier.limit) {
        return {
          ok: false,
          message: getLimitMessage(tier)
        };
      }
    }

    return { ok: true };
  }

  function render() {
    board.innerHTML = "";

    state.tiers.forEach(function (tier) {
      var row = document.createElement("section");
      row.className = "tier-row tier-" + tier.id;

      var label = document.createElement("div");
      label.className = "tier-label";
      label.textContent = tier.title;

      var count = document.createElement("small");
      count.textContent = getTierCounter(tier);
      label.appendChild(count);

      var zone = document.createElement("div");
      zone.className = "items-zone";
      zone.dataset.tierId = tier.id;

      if (tier.items.length === 0) {
        var empty = document.createElement("p");
        empty.className = "empty-tier";
        empty.textContent = "Пусто";
        zone.appendChild(empty);
      }

      tier.items.forEach(function (item) {
        zone.appendChild(renderItem(item));
      });

      row.appendChild(label);
      row.appendChild(zone);
      board.appendChild(row);
    });

    resizeCardTextareas();
    updateCardEditMode();
  }

  function renderItem(item) {
    var card = document.createElement("article");
    card.className = "item-card";
    card.draggable = !isMobileLayout();
    card.dataset.itemId = item.id;

    var textarea = document.createElement("textarea");
    textarea.className = "card-title";
    textarea.dataset.itemId = item.id;
    textarea.maxLength = MAX_TITLE_LENGTH;
    textarea.rows = 1;
    textarea.value = item.title;
    textarea.setAttribute("aria-label", "Название карточки");
    textarea.readOnly = isMobileLayout();

    var deleteButton = document.createElement("button");
    deleteButton.className = "delete-card";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete-item";
    deleteButton.dataset.itemId = item.id;
    deleteButton.setAttribute("aria-label", "Удалить карточку");
    deleteButton.textContent = "×";

    var moveButton = document.createElement("button");
    moveButton.className = "move-card";
    moveButton.type = "button";
    moveButton.dataset.action = "move-item";
    moveButton.dataset.itemId = item.id;
    moveButton.textContent = "Переместить";

    card.appendChild(textarea);
    card.appendChild(moveButton);
    card.appendChild(deleteButton);

    return card;
  }

  function openMoveSheet(itemId) {
    var foundItem = findItem(state, itemId);

    if (!foundItem) {
      return;
    }

    closeMoveSheet();
    moveSheetItemId = itemId;

    var sheet = document.createElement("div");
    sheet.className = "move-sheet";
    sheet.addEventListener("click", function (event) {
      if (event.target === sheet) {
        closeMoveSheet();
      }
    });

    var panel = document.createElement("section");
    panel.className = "move-panel";
    panel.setAttribute("aria-label", "Переместить карточку");

    var title = document.createElement("h2");
    title.textContent = "Куда переместить?";

    var itemTitle = document.createElement("p");
    itemTitle.className = "move-item-title";
    itemTitle.textContent = foundItem.item.title;

    var actions = document.createElement("div");
    actions.className = "move-actions";

    state.tiers.forEach(function (tier) {
      var button = document.createElement("button");
      button.className = "move-option";
      button.type = "button";
      button.dataset.moveTarget = tier.id;
      button.textContent = tier.title;

      if (foundItem.tier.id === tier.id) {
        button.disabled = true;
      }

      actions.appendChild(button);
    });

    var editButton = document.createElement("button");
    editButton.className = "move-secondary";
    editButton.type = "button";
    editButton.dataset.action = "edit-card-text";
    editButton.textContent = "Редактировать текст";

    var closeButton = document.createElement("button");
    closeButton.className = "move-secondary";
    closeButton.type = "button";
    closeButton.dataset.action = "close-move-sheet";
    closeButton.textContent = "Отмена";

    panel.appendChild(title);
    panel.appendChild(itemTitle);
    panel.appendChild(actions);
    panel.appendChild(editButton);
    panel.appendChild(closeButton);
    sheet.appendChild(panel);
    document.body.appendChild(sheet);
  }

  function showFeedbackDialog(message) {
    var dialog = document.createElement("div");
    var panel = document.createElement("section");
    var title = document.createElement("h2");
    var text = document.createElement("p");
    var button = document.createElement("button");

    closeFeedbackDialog();

    dialog.className = "feedback-dialog";
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        closeFeedbackDialog();
      }
    });

    panel.className = "feedback-panel";
    panel.setAttribute("aria-label", "Сообщение");

    title.textContent = "Не получится переместить";
    text.textContent = message;

    button.className = "feedback-button";
    button.type = "button";
    button.dataset.action = "close-feedback-dialog";
    button.textContent = "Понятно";

    panel.appendChild(title);
    panel.appendChild(text);
    panel.appendChild(button);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);
  }

  function closeFeedbackDialog() {
    var dialog = document.querySelector(".feedback-dialog");

    if (dialog) {
      dialog.remove();
    }
  }

  function closeMoveSheet() {
    var sheet = document.querySelector(".move-sheet");

    if (sheet) {
      sheet.remove();
    }

    moveSheetItemId = null;
  }

  function enableMobileEditing(itemId) {
    var textarea = board.querySelector(".card-title[data-item-id='" + cssEscape(itemId) + "']");

    if (!textarea) {
      return;
    }

    textarea.readOnly = false;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  function updateCardEditMode() {
    Array.prototype.forEach.call(board.querySelectorAll(".card-title"), function (textarea) {
      textarea.readOnly = isMobileLayout();
    });
    Array.prototype.forEach.call(board.querySelectorAll(".item-card"), function (card) {
      card.draggable = !isMobileLayout();
    });
  }

  function resizeCardTextareas() {
    Array.prototype.forEach.call(board.querySelectorAll(".card-title"), function (textarea) {
      resizeTextarea(textarea);
    });
  }

  function resizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }

  function isMobileLayout() {
    return window.matchMedia("(max-width: " + MOBILE_BREAKPOINT + "px)").matches;
  }

  function encodeState(sourceState) {
    var compactState = {
      v: 1,
      t: sourceState.tiers.map(function (tier) {
        return [
          tier.id,
          tier.items.map(function (item) {
            return item.title;
          })
        ];
      })
    };

    return encodeBase64Url(JSON.stringify(compactState));
  }

  function decodeState(encoded) {
    try {
      return compactToState(JSON.parse(decodeBase64Url(encoded)));
    } catch (error) {
      try {
        return JSON.parse(encoded);
      } catch (secondError) {
        return null;
      }
    }
  }

  function compactToState(payload) {
    if (!payload || payload.v !== 1 || !Array.isArray(payload.t)) {
      throw new Error("Invalid payload");
    }

    return {
      tiers: TIER_DEFS.map(function (definition) {
        var packedTier = payload.t.find(function (entry) {
          return Array.isArray(entry) && entry[0] === definition.id;
        });
        var titles = packedTier && Array.isArray(packedTier[1]) ? packedTier[1] : [];
        var legacyD = payload.t.find(function (entry) {
          return Array.isArray(entry) && entry[0] === "D";
        });

        if (definition.id === "C" && legacyD && Array.isArray(legacyD[1])) {
          titles = titles.concat(legacyD[1]);
        }

        return {
          id: definition.id,
          title: definition.title,
          limit: definition.limit,
          items: titles.map(function (title) {
            return {
              id: createId(),
              title: title
            };
          })
        };
      })
    };
  }

  function encodeBase64Url(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = "";
    var chunkSize = 8192;

    for (var index = 0; index < bytes.length; index += chunkSize) {
      var chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodeBase64Url(encoded) {
    var normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    var padding = normalized.length % 4;

    if (padding) {
      normalized += "=".repeat(4 - padding);
    }

    var binary = atob(normalized);
    var bytes = new Uint8Array(binary.length);

    for (var index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new TextDecoder().decode(bytes);
  }

  function getHashData() {
    var rawHash = window.location.hash.replace(/^#/, "");
    if (!rawHash) {
      return "";
    }

    return new URLSearchParams(rawHash).get(DATA_KEY) || "";
  }

  function writeShareHash(encoded) {
    var nextUrl = new URL(window.location.href);
    nextUrl.hash = DATA_KEY + "=" + encoded;
    window.history.replaceState(null, "", nextUrl);
    return nextUrl.href;
  }

  function clearShareHash() {
    if (!getHashData()) {
      return;
    }

    var nextUrl = new URL(window.location.href);
    nextUrl.hash = "";
    window.history.replaceState(null, "", nextUrl);
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, encodeState(state));
    } catch (error) {
      // Storage can be disabled; the app still works through the current page and URL sharing.
    }
  }

  function readDraft() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return "";
    }
  }

  function removeDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Nothing else is needed when storage is unavailable.
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return fallbackCopy(text);
        }
      );
    }

    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-999px";
    textarea.style.top = "0";
    textarea.style.fontSize = "16px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      return document.execCommand("copy");
    } catch (error) {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  function createInitialState() {
    return {
      tiers: TIER_DEFS.map(function (definition) {
        return {
          id: definition.id,
          title: definition.title,
          limit: definition.limit,
          items: definition.id === "C" ? createDefaultItems() : []
        };
      })
    };
  }

  function createDefaultItems() {
    return DEFAULT_LOWEST_PRIORITY_ITEMS.map(function (title) {
      return {
        id: createId(),
        title: normalizeTitle(title)
      };
    });
  }

  function cloneState(sourceState) {
    return JSON.parse(JSON.stringify(sourceState));
  }

  function findItem(sourceState, itemId) {
    for (var tierIndex = 0; tierIndex < sourceState.tiers.length; tierIndex += 1) {
      var tier = sourceState.tiers[tierIndex];
      var itemIndex = tier.items.findIndex(function (item) {
        return item.id === itemId;
      });

      if (itemIndex !== -1) {
        return {
          tier: tier,
          item: tier.items[itemIndex],
          index: itemIndex
        };
      }
    }

    return null;
  }

  function getTier(sourceState, tierId) {
    return sourceState.tiers.find(function (tier) {
      return tier.id === tierId;
    });
  }

  function getTierCounter(tier) {
    if (tier.limit === null) {
      return String(tier.items.length);
    }

    return tier.items.length + "/" + tier.limit;
  }

  function getLimitMessage(tier) {
    return "WIP-лимит уровня " + tier.title + ": максимум " + tier.limit + " " + getCardWord(tier.limit);
  }

  function getCardWord(count) {
    if (count === 1) {
      return "карточка";
    }
    if (count > 1 && count < 5) {
      return "карточки";
    }
    return "карточек";
  }

  function normalizeTitle(value) {
    var title = typeof value === "string" ? value.trim() : "";
    if (!title) {
      return DEFAULT_ITEM_TITLE;
    }
    return title.slice(0, MAX_TITLE_LENGTH);
  }

  function normalizeId(value) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/'/g, "\\'");
  }

  function clearDropHighlights(exceptZone) {
    Array.prototype.forEach.call(board.querySelectorAll(".items-zone.is-over"), function (zone) {
      if (zone !== exceptZone) {
        zone.classList.remove("is-over");
      }
    });
  }

  function showStatus(message, type) {
    window.clearTimeout(statusTimer);
    status.textContent = message;
    status.dataset.type = type || "info";
    status.hidden = false;

    statusTimer = window.setTimeout(function () {
      status.hidden = true;
      status.textContent = "";
    }, 3200);
  }
})();
