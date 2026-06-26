const App = {
  monsters: [],
  filtered: [],
  shown: 0,
  batch: 80,
  team: [null,null,null,null,null],
  selectedSlot: 0,
  activeEvent: null,
  selectedTradeType: "Хочу",
  nick: localStorage.getItem("bc_nick") || "",
  eventSet: new Set(),
  boostSet: new Set(),
  telegramUser: null,
  miniId: "",
  tradeTarget: null,
  tradeGive: [],
  tradeGet: [],
  tradeFiltered: [],
  tradeShown: 0,
  tradeBatch: 40,
  elementMap: {},
  friends: [],
  friendRequests: [],
  activeFriend: null,
  homeFeed: {events: [], news: []}
};

const API_BASE = localStorage.getItem("bc_api_base") || "http://localhost:8000";

async function apiRequest(path, options = {}){
  try{
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {"Content-Type":"application/json", ...(options.headers || {})},
      ...options
    });
    if(!res.ok) throw new Error(await res.text());
    return await res.json();
  }catch(err){
    console.warn("Backend unavailable, local mode:", err.message);
    return null;
  }
}

async function syncTelegramBackend(){
  const tg = window.Telegram?.WebApp;
  const payload = {
    initData: tg?.initData || "",
    user: App.telegramUser || {},
    localMiniId: App.miniId
  };
  const data = await apiRequest("/api/auth/telegram", {method:"POST", body:JSON.stringify(payload)});
  if(data?.user){
    App.miniId = String(data.user.id);
    localStorage.setItem("bc_mini_id", App.miniId);
    if(data.user.name) localStorage.setItem("bc_profile_name", data.user.name);
    if(data.user.username) localStorage.setItem("bc_profile_username", data.user.username);
    if(data.user.avatar) localStorage.setItem("bc_profile_photo", data.user.avatar);
  }
  return data;
}

const EVENTS = [
  {id:"event1", title:"Rockalypse", icon:"🪨", desc:"Главное событие Battle Camp", status:"АКТИВНО"},
  {id:"event2", title:"PVP League", icon:"🏆", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event3", title:"Dominion", icon:"👑", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event4", title:"Dominion FFA", icon:"⚔️", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event5", title:"Battle Royale", icon:"💥", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event6", title:"Serpenta's Ascension", icon:"🐍", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event7", title:"Crystal Siege", icon:"💎", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event8", title:"Sanctiflyer", icon:"🪽", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event9", title:"Celestial Towers", icon:"🌌", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event10", title:"Troop Wars", icon:"🛡️", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event11", title:"Exodawn", icon:"🌅", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event12", title:"Coliseum", icon:"🏛️", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event13", title:"Raging Rabbits", icon:"🐰", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event14", title:"Battle Royale", icon:"🔥", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event15", title:"Laboratory of Love", icon:"💘", desc:"Главное событие Battle Camp", status:"СКОРО"},
  {id:"event16", title:"Raid Start!", icon:"🚨", desc:"Главное событие Battle Camp", status:"СКОРО"}
];


const EVENT_BANNERS = {
  "Rockalypse": "assets/events/Rockalypse.png",
  "PVP League": "assets/events/PVP_League.png",
  "Dominion": "assets/events/Dominion.png",
  "Dominion FFA": "assets/events/Dominion.png",
  "Battle Royale": "assets/events/Battle_Royale.png",
  "Crystal Siege": "assets/events/Crystal_Siege.png",
  "Sanctiflyer": "assets/events/Sanctiflyer.png",
  "Celestial Towers": "assets/events/Celestial_Towers.png",
  "Troop Wars": "assets/events/Troop_Wars.png",
  "Exodawn": "assets/events/Exodawn.png",
  "Coliseum": "assets/events/Coliseum.png",
  "Raging Rabbits": "assets/events/Raging_Rabbits.png",
  "Laboratory of Love": "assets/events/Laboratory_of_Love.png",
  "Serpenta's Ascension": "assets/events/Serpenta's_Ascension.png",
  "Raid Start!": "assets/events/Raid_Start.png"
};

function eventBanner(title){
  return EVENT_BANNERS[title] || "";
}

function $(q){ return document.querySelector(q); }
function $all(q){ return [...document.querySelectorAll(q)]; }
function imagePath(monster){ return monster?.image || "assets/monsters/no-image.png"; }

function route(name){
  $all(".page").forEach(p => p.classList.remove("active"));
  const page = $(`#page-${name}`);
  if(page) page.classList.add("active");
  $all(".bottom-nav button").forEach(b => b.classList.toggle("active", b.dataset.route === name));
  if(name === "home") renderHome();
  if(name === "profile") { renderProfile(); renderTelegramProfile(); renderIncomingTrades(); renderFriends(); }
  if(name === "friend") renderFriendProfile();
  if(name === "trades") { renderTradeSlots();
  applyTradeSearch();
  renderNotifications();
  renderIncomingTrades(); renderTradeSlots(); applyTradeSearch(); renderNotifications(); }
  window.scrollTo({top:0, behavior:"smooth"});
}

async function init(){
  try{
    const tg = window.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
    App.telegramUser = tg?.initDataUnsafe?.user || null;
  }catch(e){}
  initTelegramProfile();
  syncTelegramBackend();

  const res = await fetch("data/monsters.json");
  App.monsters = await res.json();

  await loadBadgeLists();
  await loadElementMap();
  applyBadgeLists();
  applyElementMap();

  App.filtered = [...App.monsters];

  bind();
  renderEvents();
  renderHome();
  renderRarityFilter();
  renderTeam();
  applyFilters();
  renderTrades();

  if(App.nick){
    $("#nickInput").value = App.nick;
    $("#homeCards").classList.remove("hidden");
    const pn = $("#profileNick"); if(pn) pn.textContent = App.nick;
  }
}


async function loadBadgeLists(){
  async function loadList(path){
    try{
      const res = await fetch(path + "?v=" + Date.now());
      if(!res.ok) return [];
      return await res.json();
    }catch(e){
      return [];
    }
  }
  const events = await loadList("data/event-monsters.json");
  const boosts = await loadList("data/boost-monsters.json");
  App.eventSet = new Set(events.map(x => String(x).trim().toLowerCase()));
  App.boostSet = new Set(boosts.map(x => String(x).trim().toLowerCase()));
}

function applyBadgeLists(){
  App.monsters = App.monsters.map(m => {
    const nameKey = String(m.name || "").trim().toLowerCase();

    // Event имеет приоритет.
    // Event = R, Boost = E.
    const isEvent = App.eventSet.has(nameKey);
    const isBoost = !isEvent && App.boostSet.has(nameKey);

    return {
      ...m,
      isEvent,
      isBoost,
      primaryBadge: isEvent ? "R" : (isBoost ? "E" : "")
    };
  });
}



function initTelegramProfile(){
  const u = App.telegramUser || {};
  const fallbackId = localStorage.getItem("bc_mini_id") || String(Math.floor(100000000 + Math.random()*900000000));
  localStorage.setItem("bc_mini_id", String(u.id || fallbackId));
  App.miniId = String(u.id || fallbackId);

  const first = u.first_name || "";
  const last = u.last_name || "";
  const fullName = `${first} ${last}`.trim() || localStorage.getItem("bc_nick") || "Игрок";
  const username = u.username ? `@${u.username}` : "@local_user";

  localStorage.setItem("bc_profile_name", fullName);
  localStorage.setItem("bc_profile_username", username);
  if(u.photo_url) localStorage.setItem("bc_profile_photo", u.photo_url);
}

function renderTelegramProfile(){
  const name = localStorage.getItem("bc_profile_name") || App.nick || "Игрок";
  const username = localStorage.getItem("bc_profile_username") || "@local_user";
  const photo = localStorage.getItem("bc_profile_photo") || "assets/monsters/no-image.png";

  $("#tgName").textContent = name;
  $("#tgUsername").textContent = username;
  $("#miniAppId").textContent = App.miniId || localStorage.getItem("bc_mini_id") || "000000";
  $("#tgAvatar").src = photo;
}

function usersKey(){ return "bc_known_users"; }
function getUsers(){
  const users = JSON.parse(localStorage.getItem(usersKey()) || "[]");
  const self = {
    id: App.miniId || localStorage.getItem("bc_mini_id"),
    name: localStorage.getItem("bc_profile_name") || App.nick || "Игрок",
    username: localStorage.getItem("bc_profile_username") || "@local_user",
    avatar: localStorage.getItem("bc_profile_photo") || "assets/monsters/no-image.png"
  };
  if(!users.some(u => String(u.id) === String(self.id))) users.push(self);
  return users;
}
function setUsers(users){ localStorage.setItem(usersKey(), JSON.stringify(users)); }

async function findTradeUser(){
  const id = $("#tradeUserId").value.trim();
  if(!id) return alert("Введите ID пользователя");

  const remote = await apiRequest(`/api/users/${encodeURIComponent(id)}`);
  if(remote?.user){
    App.tradeTarget = {
      id: String(remote.user.id),
      name: remote.user.name || `Игрок ${id}`,
      username: remote.user.username || "",
      avatar: remote.user.avatar || "assets/monsters/no-image.png"
    };
    renderTradeTarget();
    return;
  }

  let users = getUsers();
  let user = users.find(u => String(u.id) === id);

  if(!user){
    // Пока нет backend, создаём локальную карточку найденного игрока.
    user = {
      id,
      name: `Игрок ${id.slice(-4)}`,
      username: "@battlecamp_player",
      avatar: "assets/monsters/no-image.png"
    };
    users.push(user);
    setUsers(users);
  }

  App.tradeTarget = user;
  renderTradeTarget();
}

function renderTradeTarget(){
  const box = $("#tradeTargetCard");
  if(!App.tradeTarget){
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `
    <img src="${App.tradeTarget.avatar}" onerror="this.src='assets/monsters/no-image.png'" alt="">
    <div>
      <b>${escapeHtml(App.tradeTarget.name)}</b>
      <small>${escapeHtml(App.tradeTarget.username || "")}</small>
      <span>ID: ${escapeHtml(App.tradeTarget.id)}</span>
    </div>
  `;
}

function renderTradeSlots(){
  const render = (items, zone) => {
    const html = Array.from({length: 5}).map((_,i) => {
      const m = items[i];
      return `<div class="trade-slot ${m ? "filled" : ""}">
        ${m ? `
          <button class="remove trade-remove-mini" data-trade-slot-remove="${zone}:${i}" type="button">×</button>
          <img src="${imagePath(m)}" onerror="this.src='assets/monsters/no-image.png'" alt="">
          <b>${escapeHtml(m.name)}</b>
        ` : `<span>+</span>`}
      </div>`;
    }).join("");
    return html;
  };
  $("#giveSlots").innerHTML = render(App.tradeGive, "give");
  $("#getSlots").innerHTML = render(App.tradeGet, "get");
}

function applyTradeSearch(){
  const q = $("#tradeMonsterSearch")?.value.trim().toLowerCase() || "";
  App.tradeFiltered = App.monsters.filter(m => !q || `${m.name} ${m.code}`.toLowerCase().includes(q));
  App.tradeShown = 0;
  $("#tradeMonsterGrid").innerHTML = "";
  renderMoreTradeMonsters();
}

function renderMoreTradeMonsters(){
  const part = App.tradeFiltered.slice(App.tradeShown, App.tradeShown + App.tradeBatch);
  App.tradeShown += part.length;
  const html = part.map(m => {
    const index = App.monsters.findIndex(x => x.uid === m.uid);
    return `
      <article class="monster-card trade-pick-card card-rarity-${rarityClass(m.rarity)}">
        <div class="badge-row">${monsterBadges(m)}</div>
        ${rarityRibbon(m)}
        <div class="element-icons">${elementIcons(m)}</div>
        <img src="${imagePath(m)}" alt="${escapeHtml(m.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/monsters/no-image.png'">
        <h3>${escapeHtml(m.name)}</h3>
        <div class="stars">${starLine(m)}</div>
        <button class="add add-pro" data-trade-add-index="${index}" type="button"><span>＋</span> Добавить</button>
      </article>
    `;
  }).join("");
  $("#tradeMonsterGrid").insertAdjacentHTML("beforeend", html);
  $("#tradeCounter").textContent = `Показано ${Math.min(App.tradeShown, App.tradeFiltered.length)} из ${App.tradeFiltered.length}`;
  $("#tradeLoadMoreBtn").style.display = App.tradeShown < App.tradeFiltered.length ? "block" : "none";
}

function addMonsterToTrade(index){
  const monster = App.monsters[index];
  if(!monster) return alert("Монстр не найден");
  const mode = $("#tradeMode").value;
  const list = mode === "give" ? App.tradeGive : App.tradeGet;
  if(list.length >= 5) return alert("Максимум 5 монстров в этом блоке");
  list.push(monster);
  renderTradeSlots();
}

async function sendTradeRequest(){
  if(!App.tradeTarget) return alert("Сначала найдите пользователя по ID");
  if(!App.tradeGive.length && !App.tradeGet.length) return alert("Добавьте монстров в обмен");

  const request = {
    id: Date.now(),
    fromId: App.miniId,
    fromName: localStorage.getItem("bc_profile_name") || App.nick || "Игрок",
    toId: App.tradeTarget.id,
    toName: App.tradeTarget.name,
    give: App.tradeGive,
    get: App.tradeGet,
    status: "pending",
    createdAt: new Date().toLocaleString("ru-RU")
  };

  const remote = await apiRequest("/api/trades", {method:"POST", body:JSON.stringify(request)});
  if(remote?.trade?.id) request.id = remote.trade.id;

  const all = getTradeRequests();
  all.unshift(request);
  setTradeRequests(all);

  addNotification(`Запрос обмена отправлен игроку ${App.tradeTarget.name}`);
  App.tradeGive = [];
  App.tradeGet = [];
  renderTradeSlots();
  renderNotifications();
  alert("Запрос на обмен отправлен");
}

function tradeRequestsKey(){ return "bc_trade_requests"; }
function getTradeRequests(){ return JSON.parse(localStorage.getItem(tradeRequestsKey()) || "[]"); }
function setTradeRequests(items){ localStorage.setItem(tradeRequestsKey(), JSON.stringify(items)); }

function notificationsKey(){ return "bc_notifications"; }
function getNotifications(){ return JSON.parse(localStorage.getItem(notificationsKey()) || "[]"); }
function setNotifications(items){ localStorage.setItem(notificationsKey(), JSON.stringify(items)); }
function addNotification(text){
  const items = getNotifications();
  items.unshift({id: Date.now(), text, date: new Date().toLocaleString("ru-RU"), unread: true});
  setNotifications(items);
}

function renderNotifications(){
  const items = getNotifications();
  $("#notificationList").innerHTML = items.length ? items.map(n => `
    <div class="notif-item ${n.unread ? "unread" : ""}">
      <b>${escapeHtml(n.text)}</b>
      <small>${escapeHtml(n.date)}</small>
    </div>
  `).join("") : `<p>Уведомлений пока нет.</p>`;
}

function renderIncomingTrades(){
  const myId = String(App.miniId || localStorage.getItem("bc_mini_id"));
  const items = getTradeRequests().filter(r => String(r.toId) === myId || String(r.fromId) === myId);
  $("#incomingTrades").innerHTML = items.length ? items.map(r => `
    <div class="incoming-trade">
      <div class="incoming-head">
        <b>${escapeHtml(r.fromName)} → ${escapeHtml(r.toName)}</b>
        <span class="status ${r.status}">${tradeStatusText(r.status)}</span>
      </div>
      <div class="incoming-cols">
        <div><small>Отдаёт</small>${miniMonsterList(r.give)}</div>
        <div><small>Получает</small>${miniMonsterList(r.get)}</div>
      </div>
      ${String(r.toId) === myId && r.status === "pending" ? `
        <div class="incoming-actions">
          <button data-trade-accept="${r.id}">Принять</button>
          <button data-trade-decline="${r.id}">Отклонить</button>
        </div>
      ` : ""}
    </div>
  `).join("") : `<p>Входящих запросов пока нет.</p>`;
}

function miniMonsterList(list){
  return (list || []).length ? `<div class="mini-monster-list">` + list.map(m => `
    <span><img src="${imagePath(m)}" onerror="this.src='assets/monsters/no-image.png'">${escapeHtml(m.name)}</span>
  `).join("") + `</div>` : `<p>—</p>`;
}

function tradeStatusText(status){
  if(status === "accepted") return "Принят";
  if(status === "declined") return "Отклонён";
  return "Ожидает";
}

async function updateTradeStatus(id, status){
  const items = getTradeRequests();
  const req = items.find(r => Number(r.id) === Number(id));
  if(!req) return;
  req.status = status;
  await apiRequest(`/api/trades/${encodeURIComponent(id)}/respond`, {method:"POST", body:JSON.stringify({status, userId: App.miniId})});
  setTradeRequests(items);
  addNotification(status === "accepted" ? "Обмен подтверждён" : "Обмен отклонён");
  renderIncomingTrades();
  renderNotifications();
}


async function loadElementMap(){
  try{
    const res = await fetch("data/monster-elements.json?v=" + Date.now());
    App.elementMap = res.ok ? await res.json() : {};
  }catch(e){
    App.elementMap = {};
  }
}

function applyElementMap(){
  App.monsters = App.monsters.map(m => {
    const elements = App.elementMap[m.name] || App.elementMap[String(m.name || "").trim()] || [];
    return {...m, elements};
  });
}


function bind(){
  $("#enterBtn").addEventListener("click", () => {
    const nick = $("#nickInput").value.trim();
    if(!nick) return alert("Введите игровой ник");
    App.nick = nick;
    localStorage.setItem("bc_nick", nick);
    const pn2 = $("#profileNick"); if(pn2) pn2.textContent = nick;
    $("#homeCards").classList.remove("hidden");
  });

  document.body.addEventListener("click", e => {
    const r = e.target.closest("[data-route]");
    if(r){ route(r.dataset.route); return; }

    const ev = e.target.closest("[data-event]");
    if(ev){ openEvent(ev.dataset.event); return; }

    const slot = e.target.closest("[data-slot]");
    if(slot){ App.selectedSlot = Number(slot.dataset.slot); renderTeam(); updateAddButtons(); return; }

    const add = e.target.closest("[data-add-index]");
    if(add){ addToTeamByIndex(Number(add.dataset.addIndex)); return; }

    const rem = e.target.closest("[data-remove]");
    if(rem){ e.stopPropagation(); App.team[Number(rem.dataset.remove)] = null; renderTeam(); saveCurrentTeam(false); updateAddButtons(); return; }

    const tradeType = e.target.closest("[data-type]");
    if(tradeType){ setTradeType(tradeType.dataset.type); return; }

    const tradeAdd = e.target.closest("[data-trade-add-index]");
    if(tradeAdd){ addMonsterToTrade(Number(tradeAdd.dataset.tradeAddIndex)); return; }

    const tradeSlotRemove = e.target.closest("[data-trade-slot-remove]");
    if(tradeSlotRemove){
      const [zone, idx] = tradeSlotRemove.dataset.tradeSlotRemove.split(":");
      const list = zone === "give" ? App.tradeGive : App.tradeGet;
      list.splice(Number(idx), 1);
      renderTradeSlots();
      return;
    }

    const accept = e.target.closest("[data-trade-accept]");
    if(accept){ updateTradeStatus(Number(accept.dataset.tradeAccept), "accepted"); return; }

    const decline = e.target.closest("[data-trade-decline]");
    if(decline){ updateTradeStatus(Number(decline.dataset.tradeDecline), "declined"); return; }

    const friendOpen = e.target.closest("[data-friend-open]");
    if(friendOpen){ openFriendProfile(friendOpen.dataset.friendOpen); return; }

    const friendAccept = e.target.closest("[data-friend-accept]");
    if(friendAccept){ acceptFriendRequest(friendAccept.dataset.friendAccept); return; }

    const friendDecline = e.target.closest("[data-friend-decline]");
    if(friendDecline){ declineFriendRequest(friendDecline.dataset.friendDecline); return; }
  });

  $("#searchInput").addEventListener("input", applyFilters);
  $("#rarityFilter").addEventListener("change", applyFilters);
  $("#sortSelect").addEventListener("change", applyFilters);
  $("#loadMoreBtn").addEventListener("click", renderMore);
  $("#clearTeamBtn").addEventListener("click", () => {
    App.team = [null,null,null,null,null];
    App.selectedSlot = 0;
    renderTeam();
    saveCurrentTeam(false);
    updateAddButtons();
  });
  $("#saveTeamBtn").addEventListener("click", () => saveCurrentTeam(true));

  const findBtn = $("#findUserBtn");
  if(findBtn) findBtn.addEventListener("click", findTradeUser);

  const tradeMonsterSearch = $("#tradeMonsterSearch");
  if(tradeMonsterSearch) tradeMonsterSearch.addEventListener("input", applyTradeSearch);

  const tradeLoadMoreBtn = $("#tradeLoadMoreBtn");
  if(tradeLoadMoreBtn) tradeLoadMoreBtn.addEventListener("click", renderMoreTradeMonsters);

  const sendTradeBtn = $("#sendTradeBtn");
  if(sendTradeBtn) sendTradeBtn.addEventListener("click", sendTradeRequest);

  const clearNotificationsBtn = $("#clearNotificationsBtn");
  if(clearNotificationsBtn) clearNotificationsBtn.addEventListener("click", () => { setNotifications([]); renderNotifications(); });

  const sendFriendBtn = $("#sendFriendBtn");
  if(sendFriendBtn) sendFriendBtn.addEventListener("click", sendFriendRequest);

  const copyMiniIdBtn = $("#copyMiniIdBtn");
  if(copyMiniIdBtn) copyMiniIdBtn.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(App.miniId || localStorage.getItem("bc_mini_id"));
    alert("ID скопирован");
  });
}

function renderEvents(){
  $("#eventsGrid").innerHTML = EVENTS.map(e => {
    const banner = eventBanner(e.title);
    return `
      <button class="event-card event-list-card ${banner ? "has-banner" : "no-banner"}" data-event="${e.id}">
        <div class="event-banner-wrap">
          ${banner ? `<img class="event-banner" src="${banner}" alt="${escapeHtml(e.title)}" loading="lazy" />` : `<div class="event-banner event-banner-fallback"><span>${e.icon}</span><b>${escapeHtml(e.title)}</b></div>`}
          <div class="event-card-icons"><span>${e.icon}</span><span>${e.status === "АКТИВНО" ? "🟢" : "⏳"}</span></div>
        </div>
        <div class="event-info">
          <b>${escapeHtml(e.title)}</b><small>${escapeHtml(e.desc || "Событие Battle Camp")}</small>
          <span class="event-status ${e.status === "АКТИВНО" ? "active" : ""}">${e.status}</span>
        </div>
      </button>
    `;
  }).join("");
}

function openEvent(id){
  App.activeEvent = EVENTS.find(e => e.id === id) || EVENTS[0];
  $("#eventTitle").textContent = App.activeEvent.title;
  const saved = localStorage.getItem(teamKey());
  App.team = saved ? JSON.parse(saved) : [null,null,null,null,null];
  App.selectedSlot = App.team.findIndex(x => !x);
  if(App.selectedSlot < 0) App.selectedSlot = 0;
  renderTeam();
  updateAddButtons();
  route("builder");
}

async function loadHomeFeed(){
  const remote = await apiRequest("/api/home-feed");
  if(remote){ App.homeFeed = remote; return; }
  const now = Date.now();
  App.homeFeed = {
    events: EVENTS.map((e,i) => ({...e, startsAt: new Date(now + i*86400000).toISOString()})).slice(0, 4),
    news: [
      {title:"Главная очищена", text:"Оставлены только ближайшие события, новости и быстрые игровые действия.", date:new Date().toLocaleDateString("ru-RU")},
      {title:"Профили друзей", text:"В профиле друга теперь видны его сохранённые команды по карточкам событий.", date:new Date().toLocaleDateString("ru-RU")},
      {title:"Игровой интерфейс", text:"Добавлены неоновые панели, боевые бейджи и визуальные акценты карточек.", date:new Date().toLocaleDateString("ru-RU")}
    ]
  };
}

async function renderHome(){
  if(!$("#nextEvents") || !$("#homeNews")) return;
  if(!App.homeFeed.events.length && !App.homeFeed.news.length) await loadHomeFeed();
  $("#nextEvents").innerHTML = (App.homeFeed.events || []).slice(0,4).map(e => {
    const date = e.startsAt ? new Date(e.startsAt).toLocaleDateString("ru-RU", {day:"2-digit", month:"short"}) : "скоро";
    const banner = eventBanner(e.title);
    return `<button class="next-event-card" data-event="${e.id}">
      ${banner ? `<img src="${banner}" alt="${escapeHtml(e.title)}">` : `<span class="next-event-emoji">${e.icon || "⚔️"}</span>`}
      <b>${escapeHtml(e.title)}</b><small>${date} · ${escapeHtml(e.status || "СКОРО")}</small>
    </button>`;
  }).join("");
  $("#homeNews").innerHTML = (App.homeFeed.news || []).slice(0,3).map(n => `
    <article class="news-card"><span>${escapeHtml(n.date || "сейчас")}</span><b>${escapeHtml(n.title)}</b><p>${escapeHtml(n.text || "")}</p></article>
  `).join("");
}

function renderRarityFilter(){
  const rarities = [...new Set(App.monsters.map(m => m.rarity).filter(Boolean))].sort();
  $("#rarityFilter").innerHTML = `<option value="">Все редкости</option>` + rarities.map(r => `<option value="${r}">${r}</option>`).join("");
}

function numPower(p){
  if(typeof p === "number") return p;
  const s = String(p || "0").toLowerCase().replace(",",".");
  const n = parseFloat(s) || 0;
  return s.includes("k") ? n * 1000 : n;
}

function applyFilters(){
  const q = $("#searchInput")?.value.trim().toLowerCase() || "";
  const rarity = $("#rarityFilter")?.value || "";
  const sort = $("#sortSelect")?.value || "power";

  App.filtered = App.monsters.filter(m => {
    const okQ = !q || `${m.name} ${m.code}`.toLowerCase().includes(q);
    const okR = !rarity || m.rarity === rarity;
    return okQ && okR;
  });

  App.filtered.sort((a,b) => {
    if(sort === "name") return a.name.localeCompare(b.name);
    if(sort === "attack") return (b.attack||0) - (a.attack||0);
    if(sort === "health") return (b.health||0) - (a.health||0);
    return numPower(b.power) - numPower(a.power);
  });

  App.shown = 0;
  $("#monsterGrid").innerHTML = "";
  renderMore();
}


function rarityClass(rarity){
  const r = String(rarity || "").toUpperCase();
  if(r.includes("MYTH")) return "mythic";
  if(r.includes("LEGEND")) return "legendary";
  if(r.includes("EPIC")) return "epic";
  if(r.includes("ULTRA")) return "ultra";
  if(r.includes("SUPER")) return "super";
  if(r.includes("RARE")) return "rare";
  return "common";
}

function rarityNameRu(rarity){
  const r = String(rarity || "").toUpperCase();
  if(r.includes("MYTH")) return "Mythic";
  if(r.includes("LEGEND")) return "Legendary";
  if(r.includes("EPIC")) return "Epic";
  if(r.includes("ULTRA")) return "Ultra";
  if(r.includes("SUPER")) return "Super";
  if(r.includes("RARE")) return "Rare";
  return "Common";
}

function rarityStars(rarity){
  const r = String(rarity || "").toUpperCase();
  if(r.includes("MYTH")) return 7;
  if(r.includes("LEGEND")) return 6;
  if(r.includes("EPIC")) return 5;
  if(r.includes("ULTRA")) return 4;
  if(r.includes("SUPER")) return 3;
  if(r.includes("RARE")) return 2;
  return 1;
}

function starLine(m){
  const count = Number(m.stars || rarityStars(m.rarity));
  return `<span class="stars-gold">${"★".repeat(count)}</span><span class="stars-dim">${"★".repeat(Math.max(0, 7-count))}</span>`;
}

function primaryBadge(m){
  if(m.primaryBadge === "R" || m.isEvent) {
    return `<span class="corner-badge badge-event">R</span>`;
  }
  if(m.primaryBadge === "E" || m.isBoost) {
    return `<span class="corner-badge badge-boost">E</span>`;
  }
  return "";
}

function monsterBadges(m){
  return primaryBadge(m);
}

function rarityRibbon(m){
  return `<div class="rarity-ribbon ${rarityClass(m.rarity)}"><span>${rarityNameRu(m.rarity)}</span></div>`;
}

function elementIcons(m){
  const allowed = new Set(["fire","water","rock","wind","leaf"]);
  const elements = Array.isArray(m.elements) ? m.elements : [];
  const clean = elements.filter(e => allowed.has(String(e).toLowerCase())).slice(0, 2);
  return clean.map(icon =>
    `<img class="element-icon-img" src="assets/elements/${icon}.png" alt="${icon}">`
  ).join("");
}

function renderMore(){
  const part = App.filtered.slice(App.shown, App.shown + App.batch);
  App.shown += part.length;

  const html = part.map(m => {
    const index = App.monsters.findIndex(x => x.uid === m.uid);
    return `
      <article class="monster-card card-rarity-${rarityClass(m.rarity)}">
        <div class="badge-row">${monsterBadges(m)}</div>
        ${rarityRibbon(m)}
        <div class="element-icons">${elementIcons(m)}</div>
        <img src="${imagePath(m)}" alt="${escapeHtml(m.name)}" loading="lazy" onerror="this.onerror=null;this.src='assets/monsters/no-image.png'">
        <h3>${escapeHtml(m.name)}</h3>
        <div class="stars">${starLine(m)}</div>
        <div class="stats stat-grid-pro">
          <div class="stat stat-atk"><span>АТК</span><b>${m.attack || 0}</b></div>
          <div class="stat stat-hp"><span>HP</span><b>${m.health || 0}</b></div>
          <div class="stat stat-rec"><span>РЕК</span><b>${m.recovery || 0}</b></div>
          <div class="stat stat-pr"><span>PR</span><b>${m.power || 0}</b></div>
        </div>
        <button class="add add-pro" data-add-index="${index}" type="button"><span>＋</span> Добавить в слот ${App.selectedSlot + 1}</button>
      </article>
    `;
  }).join("");

  $("#monsterGrid").insertAdjacentHTML("beforeend", html);
  $("#counter").textContent = `Показано ${Math.min(App.shown, App.filtered.length)} из ${App.filtered.length}. Всего в базе: ${App.monsters.length}`;
  $("#loadMoreBtn").style.display = App.shown < App.filtered.length ? "block" : "none";
}

function updateAddButtons(){
  $all("[data-add-index]").forEach(btn => btn.textContent = `Добавить в слот ${App.selectedSlot + 1}`);
}

function addToTeamByIndex(index){
  const monster = App.monsters[index];
  if(!monster){
    console.error("Monster index not found:", index);
    alert("Монстр не найден: ошибка индекса");
    return;
  }

  let slot = Number(App.selectedSlot);
  if(!Number.isInteger(slot) || slot < 0 || slot > 4) slot = 0;

  App.team[slot] = monster;

  const nextEmpty = App.team.findIndex(x => !x);
  App.selectedSlot = nextEmpty >= 0 ? nextEmpty : slot;

  renderTeam();
  saveCurrentTeam(false);
  updateAddButtons();
}

function renderTeam(){
  $("#teamSlots").innerHTML = App.team.map((m,i) => `
    <div class="slot ${m ? "filled" : ""} ${i === App.selectedSlot ? "active-slot" : ""}" data-slot="${i}">
      ${m ? `
        <button class="remove" data-remove="${i}" type="button">×</button>
        <div>
          <img src="${imagePath(m)}" onerror="this.onerror=null;this.src='assets/monsters/no-image.png'" alt="">
          <b>${escapeHtml(m.name)}</b>
        </div>
      ` : `<span class="hint">Слот ${i+1}<br>нажмите сюда</span>`}
    </div>
  `).join("");
}

function teamKey(){
  return `bc_team_${App.nick || "guest"}_${App.activeEvent?.id || "default"}`;
}

function saveCurrentTeam(showAlert){
  if(!App.activeEvent) return;
  localStorage.setItem(teamKey(), JSON.stringify(App.team));
  apiRequest("/api/teams", {method:"POST", body:JSON.stringify({
    userId: App.miniId || localStorage.getItem("bc_mini_id") || App.nick || "guest",
    eventId: App.activeEvent.id,
    eventTitle: App.activeEvent.title,
    team: App.team.filter(Boolean)
  })});
  if(showAlert) alert("Состав сохранён");
}

/* Trades */
function tradesKey(){ return `bc_trades_${App.nick || "guest"}`; }
function getTrades(){ return JSON.parse(localStorage.getItem(tradesKey()) || "[]"); }
function setTrades(items){ localStorage.setItem(tradesKey(), JSON.stringify(items)); }

function setTradeType(type){
  App.selectedTradeType = type;
  $all(".trade-type").forEach(b => b.classList.toggle("active", b.dataset.type === type));
}

function addTrade(){
  const monster = $("#tradeMonster").value.trim();
  const note = $("#tradeNote").value.trim();
  if(!monster) return alert("Введите название монстра");
  const items = getTrades();
  items.unshift({
    id: Date.now(),
    type: App.selectedTradeType,
    monster,
    note,
    nick: App.nick || "Игрок",
    date: new Date().toLocaleDateString("ru-RU")
  });
  setTrades(items);
  $("#tradeMonster").value = "";
  $("#tradeNote").value = "";
  renderTrades();
}

function removeTrade(id){
  setTrades(getTrades().filter(t => Number(t.id) !== Number(id)));
  renderTrades();
}

function renderTrades(){
  if(!$("#tradeList")) return;
  const q = $("#tradeSearch")?.value.trim().toLowerCase() || "";
  const type = $("#tradeFilter")?.value || "";
  const items = getTrades().filter(t => {
    const okQ = !q || `${t.monster} ${t.note} ${t.nick}`.toLowerCase().includes(q);
    const okT = !type || t.type === type;
    return okQ && okT;
  });

  $("#tradeList").innerHTML = items.length ? items.map(t => `
    <article class="trade-item">
      <div class="head"><b>${escapeHtml(t.monster)}</b><span class="trade-badge">${escapeHtml(t.type)}</span></div>
      <small>${escapeHtml(t.nick)} · ${escapeHtml(t.date)}</small>
      <p>${escapeHtml(t.note || "Без комментария")}</p>
      <button class="trade-remove" data-trade-remove="${t.id}" type="button">Удалить</button>
    </article>
  `).join("") : `<div class="trade-item"><b>Заявок пока нет</b><p>Добавьте первую заявку на обмен.</p></div>`;
}

function renderProfile(){
  const pn3 = $("#profileNick"); if(pn3) pn3.textContent = App.nick || "Игрок";
  const keys = Object.keys(localStorage).filter(k => k.startsWith(`bc_team_${App.nick || "guest"}_`));
  $("#savedTeams").innerHTML = keys.length ? keys.map(k => {
    const eventId = k.split("_").pop();
    const ev = EVENTS.find(e => e.id === eventId);
    const team = JSON.parse(localStorage.getItem(k) || "[]").filter(Boolean);
    return `<div class="saved-team">${ev?.icon || "⚔️"} ${ev?.title || eventId}: ${team.length}/5 монстров</div>`;
  }).join("") : `<p>Пока нет сохранённых составов.</p>`;
}

function friendsKey(){ return `bc_friends_${App.miniId || localStorage.getItem("bc_mini_id") || "guest"}`; }
function friendRequestsKey(){ return `bc_friend_requests_${App.miniId || localStorage.getItem("bc_mini_id") || "guest"}`; }
function savedTeamsForNick(nick){
  const prefix = `bc_team_${nick || "guest"}_`;
  return Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => {
    const eventId = k.split("_").pop();
    const ev = EVENTS.find(e => e.id === eventId) || {id:eventId,title:eventId,icon:"⚔️"};
    const team = JSON.parse(localStorage.getItem(k) || "[]").filter(Boolean);
    return {event: ev, team};
  });
}
function getFriends(){ return JSON.parse(localStorage.getItem(friendsKey()) || "[]"); }
function setFriends(items){ localStorage.setItem(friendsKey(), JSON.stringify(items)); }
function getFriendRequests(){ return JSON.parse(localStorage.getItem(friendRequestsKey()) || "[]"); }
function setFriendRequests(items){ localStorage.setItem(friendRequestsKey(), JSON.stringify(items)); }
async function sendFriendRequest(){
  const q = $("#friendSearchInput")?.value.trim();
  if(!q) return alert("Введите ID или ник друга");
  let friend = null;
  const remote = await apiRequest(`/api/users/${encodeURIComponent(q)}`);
  if(remote?.user) friend = {id:String(remote.user.id), name:remote.user.name || `Игрок ${q}`, username:remote.user.username || "", avatar:remote.user.avatar || "assets/monsters/no-image.png", nick:remote.user.name || q};
  if(!friend) friend = {id:q, name:`Игрок ${q}`, username:"локальная заявка", avatar:"assets/monsters/no-image.png", nick:q};
  apiRequest("/api/friends/request", {method:"POST", body:JSON.stringify({fromId: App.miniId || localStorage.getItem("bc_mini_id"), toId: friend.id})});
  const reqs = getFriendRequests();
  if(!reqs.some(r => String(r.id) === String(friend.id))) reqs.unshift({...friend, incoming:true, date:new Date().toLocaleDateString("ru-RU")});
  setFriendRequests(reqs);
  $("#friendSearchInput").value = "";
  renderFriends();
  alert("Заявка добавлена. В локальном режиме её можно принять сразу для проверки профиля друга.");
}
function acceptFriendRequest(id){
  const reqs = getFriendRequests();
  const req = reqs.find(r => String(r.id) === String(id));
  if(!req) return;
  const friends = getFriends();
  if(!friends.some(f => String(f.id) === String(id))) friends.unshift(req);
  setFriends(friends);
  setFriendRequests(reqs.filter(r => String(r.id) !== String(id)));
  renderFriends();
}
function declineFriendRequest(id){ setFriendRequests(getFriendRequests().filter(r => String(r.id) !== String(id))); renderFriends(); }
function renderFriends(){
  if(!$("#friendsList")) return;
  const friends = getFriends();
  const reqs = getFriendRequests();
  $("#friendsCount").textContent = friends.length;
  $("#friendRequests").innerHTML = reqs.length ? `<div class="request-title">Заявки</div>` + reqs.map(r => `
    <div class="friend-row"><img src="${r.avatar}" onerror="this.src='assets/monsters/no-image.png'"><div><b>${escapeHtml(r.name)}</b><small>${escapeHtml(r.username || r.id)}</small></div><button data-friend-accept="${escapeHtml(r.id)}">Принять</button><button data-friend-decline="${escapeHtml(r.id)}">×</button></div>
  `).join("") : "";
  $("#friendsList").innerHTML = friends.length ? friends.map(f => `
    <button class="friend-row friend-click" data-friend-open="${escapeHtml(f.id)}"><img src="${f.avatar}" onerror="this.src='assets/monsters/no-image.png'"><div><b>${escapeHtml(f.name)}</b><small>${escapeHtml(f.username || f.id)}</small></div><span>▶</span></button>
  `).join("") : `<p>Пока нет друзей. Найдите игрока по ID и примите заявку.</p>`;
}
function openFriendProfile(id){
  App.activeFriend = getFriends().find(f => String(f.id) === String(id)) || null;
  if(!App.activeFriend) return;
  route("friend");
}
function renderFriendProfile(){
  const f = App.activeFriend;
  if(!f) return;
  $("#friendTitle").textContent = f.name;
  $("#friendProfileCard").innerHTML = `<img class="tg-avatar" src="${f.avatar}" onerror="this.src='assets/monsters/no-image.png'"><div class="profile-main"><h3>${escapeHtml(f.name)}</h3><p>${escapeHtml(f.username || "ID " + f.id)}</p><small>Нажмите карточку события, чтобы увидеть команду друга.</small></div>`;
  const teams = savedTeamsForNick(f.nick || f.name || f.id);
  const demoTeams = teams.length ? teams : EVENTS.slice(0,4).map((ev,i) => ({event:ev, team:App.monsters.slice(i*5,i*5+5)}));
  $("#friendEventTeams").innerHTML = demoTeams.map(item => {
    const banner = eventBanner(item.event.title);
    return `<details class="friend-event-card"><summary>${banner ? `<img src="${banner}" alt="">` : `<span>${item.event.icon}</span>`}<b>${escapeHtml(item.event.title)}</b><small>${item.team.filter(Boolean).length}/5</small></summary><div class="friend-team-list">${item.team.filter(Boolean).map(m => `<div><img src="${imagePath(m)}" onerror="this.src='assets/monsters/no-image.png'"><b>${escapeHtml(m.name)}</b></div>`).join("") || "<p>Команда ещё не сохранена.</p>"}</div></details>`;
  }).join("");
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

init();
