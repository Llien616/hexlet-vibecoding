(() => {
  "use strict";

  const TAPE_MIN = 14;
  const TAPE_MAX = 45;
  const TAPE_SPAN = TAPE_MAX - TAPE_MIN;

  const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const $ = (id) => document.getElementById(id);
  const form = $("calc-form");
  const panel = $("result");
  const live = $("live");

  const fields = {
    age: {
      el: $("age"),
      wrap: $("field-age"),
      error: $("age-error"),
      min: 18,
      max: 99,
      unit: "лет",
    },
    height: {
      el: $("height"),
      wrap: $("field-height"),
      error: $("height-error"),
      min: 120,
      max: 230,
      unit: "см",
    },
    weight: {
      el: $("weight"),
      wrap: $("field-weight"),
      error: $("weight-error"),
      min: 35,
      max: 250,
      unit: "кг",
    },
  };

  const GOALS = {
    maintain: { factor: 1, note: "поддержание веса" },
    lose: { factor: 0.85, note: "дефицит 15%" },
    gain: { factor: 1.1, note: "профицит 10%" },
  };

  const CATEGORIES = [
    { max: 18.5, label: "Дефицит массы", color: "#7B93FF" },
    { max: 25, label: "Норма", color: "#3FC2AC" },
    { max: 30, label: "Избыточный вес", color: "#F2B34C" },
    { max: 35, label: "Ожирение I ст.", color: "#F0728F" },
    { max: 40, label: "Ожирение II ст.", color: "#F0728F" },
    { max: Infinity, label: "Ожирение III ст.", color: "#F0728F" },
  ];

  const marker = $("tape-marker");
  const flag = $("tape-flag");
  const badge = $("bmi-badge");
  const warning = $("kcal-warning");

  const pct = (value) =>
    Math.min(100, Math.max(0, ((value - TAPE_MIN) / TAPE_SPAN) * 100));

  const getSelected = (name) =>
    form.querySelector(`input[name="${name}"]:checked`);

  /* ---------- шкала ---------- */

  const ticks = $("tape-ticks");
  for (let value = 15; value <= 45; value += 1) {
    const tick = document.createElement("span");
    tick.className = "tick" + (value % 5 === 0 ? " tick--major" : "");
    tick.style.left = `${pct(value)}%`;
    ticks.append(tick);
  }

  const labels = $("tape-labels");
  [15, 20, 25, 30, 35, 40].forEach((value) => {
    const label = document.createElement("span");
    label.textContent = String(value);
    label.style.left = `${pct(value)}%`;
    labels.append(label);
  });

  /* ---------- валидация ---------- */

  function readField(field) {
    const raw = field.el.value.trim().replace(",", ".");

    field.wrap.classList.remove("is-invalid");
    field.error.textContent = "";
    field.el.removeAttribute("aria-invalid");

    if (!raw) return null;

    const value = Number(raw);

    if (!Number.isFinite(value)) {
      field.wrap.classList.add("is-invalid");
      field.error.textContent = "Введите число";
      field.el.setAttribute("aria-invalid", "true");
      return null;
    }

    if (value < field.min || value > field.max) {
      field.wrap.classList.add("is-invalid");
      field.error.textContent = `От ${field.min} до ${field.max} ${field.unit}`;
      field.el.setAttribute("aria-invalid", "true");
      return null;
    }

    return value;
  }

  /* ---------- отрисовка ---------- */

  function setText(id, value) {
    $(id).textContent = value;
  }

  function setBadge(label, color) {
    badge.textContent = label;
    badge.style.setProperty("--badge", color);
  }

  function renderEmpty() {
    panel.classList.add("is-empty");
    setText("bmi-value", "—");
    setBadge("Нет данных", "#B9B2C6");
    setText("tape-flag", "—");
    marker.style.left = "0%";
    setText("healthy-range", "—");
    setText("to-normal", "—");
    setText("kcal-value", "—");
    setText("bmr-value", "—");
    setText("tdee-value", "—");
    setText("delta-value", "—");
    setText("protein-value", "—");
    setText("fat-value", "—");
    setText("carbs-value", "—");
    warning.hidden = true;
    live.textContent = "Введите корректные возраст, рост и вес.";
  }

  function render() {
    const age = readField(fields.age);
    const height = readField(fields.height);
    const weight = readField(fields.weight);

    if (age === null || height === null || weight === null) {
      renderEmpty();
      return;
    }

    panel.classList.remove("is-empty");

    const sex = getSelected("sex").value;
    const activity = Number(getSelected("activity").value);
    const goal = GOALS[getSelected("goal").value];
    const meters = height / 100;

    /* ИМТ */
    const bmi = weight / (meters * meters);
    const bmiShown = Math.round(bmi * 10) / 10;
    const category =
      CATEGORIES.find((item) => bmiShown < item.max) ||
      CATEGORIES[CATEGORIES.length - 1];
    const bmiText = nf1.format(bmi);

    setText("bmi-value", bmiText);
    setBadge(category.label, category.color);
    setText("tape-flag", bmiText);
    marker.style.left = `${pct(bmi)}%`;

    /* здоровый вес */
    const low = 18.5 * meters * meters;
    const high = 24.9 * meters * meters;
    setText("healthy-range", `${nf1.format(low)}–${nf1.format(high)} кг`);

    if (bmiShown < 18.5) {
      setText("to-normal", `+${nf1.format(low - weight)} кг`);
    } else if (bmiShown >= 25) {
      setText("to-normal", `−${nf1.format(weight - high)} кг`);
    } else {
      setText("to-normal", "уже в норме");
    }

    /* калории */
    const bmrRaw = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
    const tdeeRaw = bmrRaw * activity;
    const targetRaw = tdeeRaw * goal.factor;

    const bmr = Math.round(bmrRaw);
    const tdee = Math.round(tdeeRaw);
    const target = Math.round(targetRaw);
    const delta = target - tdee;

    setText("kcal-value", nf0.format(target));
    setText("goal-note", goal.note);
    setText("bmr-value", `${nf0.format(bmr)} ккал`);
    setText("tdee-value", `${nf0.format(tdee)} ккал`);

    if (delta === 0) {
      setText("delta-value", "0 ккал");
    } else if (delta < 0) {
      setText("delta-value", `−${nf0.format(Math.abs(delta))} ккал`);
    } else {
      setText("delta-value", `+${nf0.format(delta)} ккал`);
    }

    const floor = sex === "male" ? 1500 : 1200;
    if (target < floor) {
      warning.textContent = `Расчётная норма ${nf0.format(target)} ккал ниже ${nf0.format(floor)} ккал — это очень низкий рацион. Не урезайте его так без наблюдения врача.`;
      warning.hidden = false;
    } else {
      warning.hidden = true;
    }

    /* БЖУ: 30 / 30 / 40 */
    setText("protein-value", nf0.format(Math.round((target * 0.3) / 4)));
    setText("fat-value", nf0.format(Math.round((target * 0.3) / 9)));
    setText("carbs-value", nf0.format(Math.round((target * 0.4) / 4)));

    const categoryText = category.label.replace(/\.$/, "");
    live.textContent = `ИМТ ${bmiText}. ${categoryText}. Дневная норма ${nf0.format(target)} ккал.`;
  }

  /* ---------- события ---------- */

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("submit", (event) => event.preventDefault());

  $("clear-btn").addEventListener("click", () => {
    Object.values(fields).forEach((field) => {
      field.el.value = "";
    });
    render();
    fields.age.el.focus();
  });

  render();
})();
