const STORAGE_KEY = "toDoGameStateV1";

const difficultyMap = {
  easy: { label: "Easy", xp: 10, coins: 5, rank: 1 },
  normal: { label: "Normal", xp: 20, coins: 10, rank: 2 },
  boss: { label: "Boss", xp: 35, coins: 18, rank: 3 }
};

const defaultState = {
  tasks: [],
  totalXp: 0,
  coins: 0,
  completedTotal: 0,
  streak: 0,
  lastCompletionDate: "",
  dailyBonusDate: ""
};

let state = loadState();

const form = document.querySelector("#todoForm");
const taskInput = document.querySelector("#taskInput");
const difficultyInput = document.querySelector("#difficultyInput");
const dueInput = document.querySelector("#dueInput");
const filterInput = document.querySelector("#filterInput");
const sortInput = document.querySelector("#sortInput");
const taskList = document.querySelector("#taskList");
const emptyState = document.querySelector("#emptyState");
const toast = document.querySelector("#toast");

form.addEventListener("submit", addTask);
filterInput.addEventListener("change", render);
sortInput.addEventListener("change", render);
document.querySelector("#resetGame").addEventListener("click", resetGame);

render();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return structuredClone(defaultState);
  }

  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addTask(event) {
  event.preventDefault();

  const name = taskInput.value.trim();
  if (!name) {
    showToast("Write a task name first.");
    return;
  }

  state.tasks.unshift({
    id: crypto.randomUUID(),
    name,
    difficulty: difficultyInput.value,
    due: dueInput.value,
    done: false,
    rewarded: false,
    createdAt: Date.now(),
    completedAt: ""
  });

  form.reset();
  difficultyInput.value = "normal";
  saveState();
  render();
  showToast("Quest added.");
}

function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  task.done = !task.done;

  if (task.done) {
    task.completedAt = todayString();
    rewardTask(task);
  } else {
    task.completedAt = "";
  }

  saveState();
  render();
}

function rewardTask(task) {
  if (task.rewarded) {
    showToast("Quest marked done.");
    return;
  }

  const reward = difficultyMap[task.difficulty];
  state.totalXp += reward.xp;
  state.coins += reward.coins;
  state.completedTotal += 1;
  task.rewarded = true;
  updateStreak();
  maybeAwardDailyBonus();
  showToast(`Quest complete: +${reward.xp} XP and +${reward.coins} coins.`);
}

function updateStreak() {
  const today = todayString();
  const yesterday = offsetDateString(-1);

  if (state.lastCompletionDate === today) {
    return;
  }

  state.streak = state.lastCompletionDate === yesterday ? state.streak + 1 : 1;
  state.lastCompletionDate = today;
}

function maybeAwardDailyBonus() {
  const today = todayString();
  const completedToday = getCompletedToday();

  if (completedToday >= 3 && state.dailyBonusDate !== today) {
    state.totalXp += 60;
    state.coins += 40;
    state.dailyBonusDate = today;
    showToast("Daily challenge complete: +60 XP and +40 coins.");
  }
}

function editTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const nextName = prompt("Edit task name:", task.name);
  if (nextName === null) return;

  const trimmed = nextName.trim();
  if (!trimmed) {
    showToast("Task name cannot be empty.");
    return;
  }

  task.name = trimmed;
  saveState();
  render();
  showToast("Quest updated.");
}

function deleteTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const ok = confirm(`Delete "${task.name}"?`);
  if (!ok) return;

  state.tasks = state.tasks.filter((item) => item.id !== id);
  saveState();
  render();
  showToast("Quest deleted.");
}

function resetGame() {
  const ok = confirm("Reset all quests, XP, coins, and streak?");
  if (!ok) return;

  state = structuredClone(defaultState);
  saveState();
  render();
  showToast("Game reset.");
}

function render() {
  renderStats();
  renderTasks();
  renderDailyChallenge();
  saveState();
}

function renderStats() {
  const level = Math.floor(state.totalXp / 100) + 1;
  const xpInLevel = state.totalXp % 100;

  document.querySelector("#levelValue").textContent = level;
  document.querySelector("#xpValue").textContent = xpInLevel;
  document.querySelector("#coinValue").textContent = state.coins;
  document.querySelector("#streakValue").textContent = state.streak;
  document.querySelector("#nextLevelText").textContent = `${xpInLevel} XP earned`;
  document.querySelector("#xpBar").style.width = `${xpInLevel}%`;
}

function renderTasks() {
  const tasks = getVisibleTasks();
  taskList.innerHTML = "";

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.done ? " done" : ""}`;

    const reward = difficultyMap[task.difficulty];
    const dueText = task.due ? `Due ${formatDate(task.due)}` : "No due date";
    const statusText = task.done ? "Done" : "Active";

    item.innerHTML = `
      <button class="check-button" type="button" aria-label="${task.done ? "Mark active" : "Mark done"}">${task.done ? "OK" : ""}</button>
      <div>
        <span class="task-name"></span>
        <div class="task-meta">
          <span class="pill ${task.difficulty === "boss" ? "boss" : ""}">${reward.label}: ${reward.xp} XP</span>
          <span class="pill">${dueText}</span>
          <span class="pill ${task.done ? "done" : ""}">${statusText}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="tiny-button edit-button" type="button">Edit</button>
        <button class="tiny-button delete-button" type="button">Delete</button>
      </div>
    `;

    item.querySelector(".task-name").textContent = task.name;
    item.querySelector(".check-button").addEventListener("click", () => toggleTask(task.id));
    item.querySelector(".edit-button").addEventListener("click", () => editTask(task.id));
    item.querySelector(".delete-button").addEventListener("click", () => deleteTask(task.id));
    taskList.appendChild(item);
  });

  const activeCount = state.tasks.filter((task) => !task.done).length;
  const doneCount = state.tasks.filter((task) => task.done).length;
  document.querySelector("#summaryText").textContent = `${activeCount} active, ${doneCount} done`;
  emptyState.style.display = tasks.length ? "none" : "block";
}

function getVisibleTasks() {
  const filter = filterInput.value;
  const sort = sortInput.value;

  return state.tasks
    .filter((task) => {
      if (filter === "active") return !task.done;
      if (filter === "done") return task.done;
      return true;
    })
    .sort((a, b) => {
      if (sort === "due") {
        return (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31");
      }

      if (sort === "difficulty") {
        return difficultyMap[b.difficulty].rank - difficultyMap[a.difficulty].rank;
      }

      return b.createdAt - a.createdAt;
    });
}

function renderDailyChallenge() {
  const completedToday = Math.min(getCompletedToday(), 3);
  document.querySelector("#dailyText").textContent = `${completedToday} of 3 completed`;
  document.querySelector("#dailyBar").style.width = `${(completedToday / 3) * 100}%`;
}

function getCompletedToday() {
  const today = todayString();
  return state.tasks.filter((task) => task.completedAt === today).length;
}

function todayString() {
  return dateKey(new Date());
}

function offsetDateString(dayOffset) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return dateKey(date);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2300);
}
