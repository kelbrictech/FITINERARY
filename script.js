(function(){
  "use strict";

  // ---------- unit state ----------
  var sex = "m";

  var $ = function(id){ return document.getElementById(id); };

  function setProgress(current){
    var steps = Array.prototype.slice.call(document.querySelectorAll(".progress-step"));
    var lines = Array.prototype.slice.call(document.querySelectorAll(".progress-line"));
    steps.forEach(function(step,index){
      var number = index + 1;
      step.classList.toggle("active", number === current);
      step.classList.toggle("complete", number < current);
      if (number === current) step.setAttribute("aria-current","step");
      else step.removeAttribute("aria-current");
    });
    lines.forEach(function(line,index){ line.classList.toggle("complete", index < current - 1); });
  }

  function selectSex(value){
    sex = value;
    var maleSelected = value === "m";
    $("sex-m").classList.toggle("active", maleSelected);
    $("sex-f").classList.toggle("active", !maleSelected);
    $("sex-m").setAttribute("aria-pressed", maleSelected ? "true" : "false");
    $("sex-f").setAttribute("aria-pressed", maleSelected ? "false" : "true");
  }

  $("sex-m").addEventListener("click", function(){ selectSex("m"); });
  $("sex-f").addEventListener("click", function(){ selectSex("f"); });

  // ---------- dual-unit auto-conversion (cm/ft-in, kg/lb side by side) ----------
  // Each pair keeps both sides in sync as the person types; a small "last edited"
  // guard stops the two sides from fighting each other on every keystroke.
  function round1(n){ return Math.round(n*10)/10; }

  function linkHeight(){
    var cm = $("height-cm"), ft = $("height-ft"), inch = $("height-in");
    var syncing = false;
    function fromCm(){
      if (syncing) return;
      syncing = true;
      var v = parseFloat(cm.value);
      if (v > 0){
        var totalIn = v / 2.54;
        ft.value = Math.floor(totalIn/12);
        inch.value = round1(totalIn % 12);
      }
      syncing = false;
    }
    function fromFtIn(){
      if (syncing) return;
      syncing = true;
      var f = parseFloat(ft.value) || 0;
      var i = parseFloat(inch.value) || 0;
      if (f > 0 || i > 0){
        cm.value = round1((f*12 + i) * 2.54);
      }
      syncing = false;
    }
    cm.addEventListener("input", fromCm);
    ft.addEventListener("input", fromFtIn);
    inch.addEventListener("input", fromFtIn);
  }

  function linkWeightPair(kgId, lbId){
    var kg = $(kgId), lb = $(lbId);
    var syncing = false;
    function fromKg(){
      if (syncing) return;
      syncing = true;
      var v = parseFloat(kg.value);
      if (v > 0) lb.value = round1(v / 0.453592);
      syncing = false;
    }
    function fromLb(){
      if (syncing) return;
      syncing = true;
      var v = parseFloat(lb.value);
      if (v > 0) kg.value = round1(v * 0.453592);
      syncing = false;
    }
    kg.addEventListener("input", fromKg);
    lb.addEventListener("input", fromLb);
  }

  linkHeight();
  linkWeightPair("weight-kg","weight-lb");
  linkWeightPair("target-kg","target-lb");

  function setupUnitToggle(buttonId, primaryWrapId, alternateWrapId, unitLabelId, primaryUnit, alternateUnit){
    var button=$(buttonId), primary=$(primaryWrapId), alternate=$(alternateWrapId), unitLabel=$(unitLabelId);
    button.addEventListener("click",function(){
      var showingAlternate=alternate.hidden;
      alternate.hidden=!showingAlternate;
      primary.hidden=showingAlternate;
      button.setAttribute("aria-pressed",showingAlternate ? "true" : "false");
      unitLabel.textContent=showingAlternate ? alternateUnit : primaryUnit;
      button.textContent=showingAlternate ? "Use "+primaryUnit : "Use "+alternateUnit;
      var firstInput=(showingAlternate ? alternate : primary).querySelector("input");
      if (firstInput) firstInput.focus();
    });
  }

  setupUnitToggle("height-unit-toggle","height-metric-wrap","height-imperial-wrap","height-unit-label","cm","ft/in");
  setupUnitToggle("weight-unit-toggle","weight-metric-wrap","weight-imperial-wrap","weight-unit-label","kg","lb");
  setupUnitToggle("target-unit-toggle","target-metric-wrap","target-imperial-wrap","target-unit-label","kg","lb");

  function selectActivity(selected, moveFocus){
    $("activity").value = selected.getAttribute("data-activity");
    document.querySelectorAll(".activity-level").forEach(function(option){
      var isSelected = option === selected;
      option.classList.toggle("active", isSelected);
      option.setAttribute("aria-checked", isSelected ? "true" : "false");
      option.setAttribute("tabindex", isSelected ? "0" : "-1");
    });
    if (moveFocus) selected.focus();
  }

  $("activity-bars").addEventListener("click", function(event){
    var selected = event.target.closest(".activity-level");
    if (!selected) return;
    selectActivity(selected, false);
  });

  $("activity-bars").addEventListener("keydown", function(event){
    if (!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(event.key)) return;
    var options = Array.prototype.slice.call(document.querySelectorAll(".activity-level"));
    var current = options.indexOf(document.activeElement);
    if (current < 0) current = options.findIndex(function(option){ return option.getAttribute("aria-checked") === "true"; });
    var next = current;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
    else next = (current + 1) % options.length;
    event.preventDefault();
    selectActivity(options[next], true);
  });

  function setFormError(id, message){
    var feedback = $(id);
    feedback.textContent = message || "";
    feedback.hidden = !message;
    if (message) feedback.focus();
  }

  function getHeightCm(){ return parseFloat($("height-cm").value) || 0; }
  function getWeightKg(){ return parseFloat($("weight-kg").value) || 0; }
  function getTargetKg(){ return parseFloat($("target-kg").value) || 0; }

  // ---------- meal database ----------
  // Each meal: name, kcal (base serving), protein/carbs/fat (g), cuisine tags, seafood flag, recipe guide
  // cuisine tags: western, asian, ph (Philippine local), halal, kosher — a meal can carry several
  // recipe: {serves, time, ing:[...], steps:[...]}  — simple home-cook guide, scaled with the meal on the plan
  var MEALS = {
    breakfast: [
      {n:"Greek yogurt, berries & toasted oats", kcal:360, p:28, c:42, f:9, cui:["western","halal","kosher"], sf:false,
        recipe:{serves:1, time:"5 min", ing:["1 cup plain Greek yogurt","1/2 cup mixed berries","1/3 cup rolled oats, toasted","1 tsp honey"],
          steps:["Toast the oats in a dry pan 2–3 min until fragrant.","Layer yogurt, berries and oats in a bowl.","Drizzle with honey and serve."]}},
      {n:"Veggie egg-white omelet, whole-grain toast", kcal:340, p:30, c:28, f:11, cui:["western","halal","kosher"], sf:false,
        recipe:{serves:1, time:"10 min", ing:["4 egg whites","1/4 cup diced bell pepper","1/4 cup spinach","1 slice whole-grain bread"],
          steps:["Whisk egg whites; sauté pepper and spinach in a lightly oiled pan until soft.","Pour in egg whites, cook until set, fold over.","Toast the bread and serve alongside."]}},
      {n:"Overnight oats, chia & banana", kcal:390, p:16, c:58, f:11, cui:["western","halal","kosher","asian"], sf:false,
        recipe:{serves:1, time:"5 min + overnight", ing:["1/2 cup rolled oats","1 tbsp chia seeds","3/4 cup milk of choice","1/2 banana, sliced"],
          steps:["Stir oats, chia and milk together in a jar.","Refrigerate overnight.","Top with sliced banana before eating."]}},
      {n:"Tofu scramble, spinach & salsa", kcal:320, p:22, c:24, f:15, cui:["western","halal","kosher"], sf:false,
        recipe:{serves:1, time:"10 min", ing:["150g firm tofu, crumbled","1 cup spinach","2 tbsp salsa","1/2 tsp turmeric"],
          steps:["Crumble tofu into a hot, lightly oiled pan with turmeric.","Cook 4–5 min, add spinach until wilted.","Top with salsa and serve."]}},
      {n:"Cottage cheese bowl, pineapple & almonds", kcal:330, p:27, c:30, f:12, cui:["western","halal"], sf:false,
        recipe:{serves:1, time:"5 min", ing:["1 cup cottage cheese","1/2 cup pineapple chunks","1 tbsp sliced almonds"],
          steps:["Spoon cottage cheese into a bowl.","Top with pineapple and almonds.","Serve chilled."]}},
      {n:"Protein oatmeal, peanut butter swirl", kcal:410, p:26, c:48, f:13, cui:["western","halal","kosher"], sf:false,
        recipe:{serves:1, time:"8 min", ing:["1/2 cup rolled oats","1 scoop protein powder","1 tbsp peanut butter","1 cup water or milk"],
          steps:["Cook oats in water or milk until creamy.","Stir in protein powder off heat.","Swirl in peanut butter and serve."]}},
      {n:"Smoked salmon, rye toast & avocado", kcal:400, p:24, c:32, f:18, cui:["western","kosher"], sf:true,
        recipe:{serves:1, time:"7 min", ing:["80g smoked salmon","1 slice rye bread","1/4 avocado, mashed","squeeze of lemon"],
          steps:["Toast the rye bread.","Spread mashed avocado on top.","Layer smoked salmon over and finish with lemon."]}},
      {n:"Veggie breakfast burrito, black beans", kcal:420, p:22, c:50, f:15, cui:["western","halal","kosher"], sf:false,
        recipe:{serves:1, time:"12 min", ing:["1 whole-wheat tortilla","2 eggs, scrambled","1/3 cup black beans","2 tbsp salsa"],
          steps:["Scramble eggs and warm black beans.","Warm the tortilla.","Fill with eggs, beans and salsa, then roll."]}},
      {n:"Protein smoothie — spinach, mango, whey", kcal:310, p:29, c:36, f:6, cui:["western","halal","kosher"], sf:false,
        recipe:{serves:1, time:"5 min", ing:["1 cup spinach","1/2 cup frozen mango","1 scoop whey protein","1 cup milk of choice"],
          steps:["Add all ingredients to a blender.","Blend until smooth.","Pour and serve immediately."]}},
      {n:"Shakshuka with feta and crusty bread", kcal:430, p:22, c:36, f:22, cui:["western","kosher"], sf:false,
        recipe:{serves:1, time:"18 min", ing:["1 cup crushed tomatoes","2 eggs","2 tbsp crumbled feta","1 slice crusty bread"],
          steps:["Simmer crushed tomatoes with a pinch of cumin and paprika, 5 min.","Crack eggs into the sauce, cover and cook until set, 6–8 min.","Top with feta and serve with bread."]}},
      {n:"Silog set — garlic fried rice, egg & tocino", kcal:460, p:24, c:52, f:16, cui:["ph"], sf:false,
        recipe:{serves:1, time:"15 min", ing:["1 cup cooked rice","2 cloves garlic, minced","80g tocino (cured pork)","1 egg","sliced tomato & vinegar dip"],
          steps:["Fry tocino until caramelized; set aside.","Sauté garlic in the same pan, add rice, fry until golden.","Fry the egg sunny-side up and plate everything with tomato and vinegar."]}},
      {n:"Pandesal, kesong puti & sliced mango", kcal:370, p:15, c:56, f:9, cui:["ph"], sf:false,
        recipe:{serves:1, time:"5 min", ing:["2 pandesal rolls","2 tbsp kesong puti (white cheese)","1/2 ripe mango, sliced"],
          steps:["Split the pandesal and fill with kesong puti.","Warm briefly if desired.","Serve with sliced mango."]}},
      {n:"Champorado with tuyo on the side", kcal:400, p:14, c:64, f:10, cui:["ph"], sf:true,
        recipe:{serves:1, time:"20 min", ing:["1/2 cup glutinous rice","2 tbsp cocoa powder","2 tbsp sugar","1 piece tuyo (dried fish), pan-fried","evaporated milk to serve"],
          steps:["Simmer rice with cocoa and enough water until thick and porridge-like, stirring often.","Sweeten with sugar to taste.","Pan-fry the tuyo separately and serve alongside, milk drizzled on top."]}},
      {n:"Taho — sweet tofu, sago & arnibal", kcal:340, p:12, c:58, f:7, cui:["ph"], sf:false,
        recipe:{serves:1, time:"5 min (using ready tofu)", ing:["1 cup silken tofu, warmed","2 tbsp cooked sago pearls","3 tbsp arnibal (brown sugar syrup)"],
          steps:["Gently warm the silken tofu without breaking it up.","Spoon into a cup.","Top with sago and arnibal syrup."]}},
      {n:"Congee with shredded chicken & scallion", kcal:380, p:24, c:48, f:8, cui:["asian","halal"], sf:false,
        recipe:{serves:1, time:"25 min", ing:["1/2 cup rice","3 cups chicken broth","1/2 cup shredded cooked chicken","chopped scallion & ginger"],
          steps:["Simmer rice in broth, stirring occasionally, 20 min until porridge-thick.","Stir in shredded chicken to warm through.","Top with scallion and ginger."]}},
      {n:"Miso soup, steamed rice & tamagoyaki", kcal:410, p:20, c:52, f:12, cui:["asian"], sf:false,
        recipe:{serves:1, time:"15 min", ing:["1 cup dashi or water with miso paste","2 eggs (for tamagoyaki)","1/2 cup steamed rice","1 tsp soy sauce"],
          steps:["Whisk miso paste into warm dashi; keep warm without boiling.","Whisk eggs with soy sauce and cook in thin layers, rolling into a log (tamagoyaki).","Slice the tamagoyaki and serve with rice and miso soup."]}},
      {n:"Soy-glazed tofu, steamed bok choy & rice", kcal:390, p:20, c:50, f:11, cui:["asian","halal","kosher"], sf:false,
        recipe:{serves:1, time:"15 min", ing:["150g firm tofu, sliced","1 tbsp soy sauce","1 tsp honey or sugar","1 cup bok choy","1/2 cup rice"],
          steps:["Pan-sear tofu slices until golden.","Add soy sauce and honey, simmer until glazed.","Steam bok choy and serve with rice."]}},
      {n:"Kimchi fried rice with fried egg", kcal:420, p:18, c:54, f:14, cui:["asian"], sf:false,
        recipe:{serves:1, time:"12 min", ing:["1 cup cooked rice","1/2 cup chopped kimchi","1 tsp sesame oil","1 egg, fried"],
          steps:["Sauté kimchi in sesame oil 2 min.","Add rice, fry until heated through and slightly crisp.","Top with a fried egg."]}},
      {n:"Arroz caldo with chicken & toasted garlic", kcal:410, p:22, c:56, f:10, cui:["ph","halal"], sf:false,
        recipe:{serves:1, time:"30 min", ing:["1/2 cup glutinous or regular rice","2 cups chicken broth","1/2 cup shredded cooked chicken","ginger, toasted garlic & scallion"],
          steps:["Simmer rice in broth with ginger until porridge-thick, about 20 min.","Stir in shredded chicken to warm through.","Top with toasted garlic and scallion."]}}
    ],
    lunch: [
      {n:"Grilled chicken, quinoa & roasted veg", kcal:520, p:42, c:48, f:16, cui:["western","halal"], sf:false,
        recipe:{serves:1, time:"25 min", ing:["150g chicken breast","1/2 cup quinoa","1 cup mixed vegetables (zucchini, carrot, pepper)","1 tbsp olive oil"],
          steps:["Season and grill the chicken until cooked through.","Cook quinoa per package instructions.","Roast vegetables with olive oil at 200°C for 18 min; plate all together."]}},
      {n:"Seared tuna poke bowl, brown rice", kcal:540, p:36, c:60, f:14, cui:["western","asian","kosher"], sf:true,
        recipe:{serves:1, time:"15 min", ing:["150g sushi-grade tuna, cubed","1 cup cooked brown rice","1 tbsp soy sauce","1/2 avocado","cucumber, sliced"],
          steps:["Toss tuna cubes with soy sauce.","Spoon rice into a bowl.","Top with tuna, avocado and cucumber."]}},
      {n:"Lentil & vegetable soup, wholegrain roll", kcal:460, p:22, c:64, f:12, cui:["western","halal","kosher"], sf:false,
        recipe:{serves:1, time:"30 min", ing:["1/2 cup red lentils","2 cups vegetable broth","1 cup diced carrot, celery, onion","1 wholegrain roll"],
          steps:["Sauté the diced vegetables 5 min.","Add lentils and broth, simmer 20 min until soft.","Season to taste and serve with the roll."]}},
      {n:"Turkey & avocado wrap, side salad", kcal:490, p:34, c:42, f:20, cui:["western","halal"], sf:false,
        recipe:{serves:1, time:"8 min", ing:["1 whole-wheat tortilla","120g sliced turkey breast","1/2 avocado","2 cups mixed salad greens"],
          steps:["Mash avocado onto the tortilla.","Layer turkey and roll tightly.","Slice and serve with a side of dressed greens."]}},
      {n:"Chickpea & feta grain bowl", kcal:510, p:20, c:62, f:18, cui:["western","kosher"], sf:false,
        recipe:{serves:1, time:"15 min", ing:["3/4 cup cooked chickpeas","1/2 cup cooked farro or bulgur","2 tbsp crumbled feta","cherry tomatoes & cucumber"],
          steps:["Combine grain and chickpeas in a bowl.","Add chopped tomato and cucumber.","Top with feta and a drizzle of olive oil."]}},
      {n:"Falafel bowl, tahini & tabbouleh", kcal:500, p:18, c:60, f:20, cui:["western","halal","kosher"], sf:false,
        recipe:{serves:1, time:"15 min (using pre-made falafel)", ing:["5 falafel balls","1/2 cup tabbouleh","2 tbsp tahini sauce","pita on the side"],
          steps:["Warm the falafel in a pan or oven.","Plate with tabbouleh.","Drizzle with tahini and serve with pita."]}},
      {n:"Mediterranean tuna salad, olives & chickpeas", kcal:450, p:30, c:34, f:20, cui:["western","kosher"], sf:true,
        recipe:{serves:1, time:"10 min", ing:["1 can tuna, drained","1/2 cup chickpeas","6 olives","cherry tomatoes","1 tbsp olive oil & lemon"],
          steps:["Combine tuna, chickpeas, olives and tomatoes in a bowl.","Dress with olive oil and lemon juice.","Toss and serve."]}},
      {n:"Grilled shrimp, soba noodles, sesame greens", kcal:470, p:32, c:52, f:13, cui:["asian"], sf:true,
        recipe:{serves:1, time:"18 min", ing:["150g shrimp, peeled","80g soba noodles","1 cup bok choy or spinach","1 tsp sesame oil"],
          steps:["Cook soba noodles per package, drain and rinse.","Grill or pan-sear shrimp 2–3 min per side.","Toss greens in sesame oil, plate with noodles and shrimp."]}},
      {n:"Beef & broccoli stir-fry, jasmine rice", kcal:560, p:38, c:58, f:17, cui:["asian","halal"], sf:false,
        recipe:{serves:1, time:"18 min", ing:["150g beef strips","1.5 cups broccoli florets","2 tbsp soy-based stir-fry sauce","3/4 cup jasmine rice"],
          steps:["Cook rice per package instructions.","Stir-fry beef over high heat 2–3 min, remove.","Stir-fry broccoli, return beef, add sauce and toss to coat."]}},
      {n:"Chicken tikka, cauliflower rice", kcal:480, p:40, c:36, f:18, cui:["asian","halal"], sf:false,
        recipe:{serves:1, time:"25 min (plus marinade)", ing:["150g chicken thigh, cubed","2 tbsp yogurt & tikka spice mix","2 cups riced cauliflower","1 tsp oil"],
          steps:["Marinate chicken in yogurt and spices at least 20 min.","Grill or pan-sear until cooked through.","Sauté cauliflower rice in oil 5–6 min and serve alongside."]}},
      {n:"Bulgogi beef, steamed rice & kimchi", kcal:560, p:36, c:54, f:20, cui:["asian"], sf:false,
        recipe:{serves:1, time:"20 min (plus marinade)", ing:["150g thinly sliced beef","2 tbsp bulgogi marinade (soy, pear, garlic, sesame)","3/4 cup steamed rice","kimchi to serve"],
          steps:["Marinate beef at least 15 min.","Sear over high heat 3–4 min until caramelized.","Serve over rice with kimchi on the side."]}},
      {n:"Chicken pad thai", kcal:540, p:30, c:62, f:16, cui:["asian","halal"], sf:false,
        recipe:{serves:1, time:"20 min", ing:["100g rice noodles","120g chicken breast, sliced","2 tbsp pad thai sauce","1 egg","bean sprouts & crushed peanuts"],
          steps:["Soak rice noodles until pliable.","Stir-fry chicken until cooked, push aside, scramble egg in the same pan.","Add noodles and sauce, toss together, top with sprouts and peanuts."]}},
      {n:"Chicken adobo, garlic rice & atsara", kcal:560, p:38, c:56, f:18, cui:["ph","halal"], sf:false,
        recipe:{serves:1, time:"35 min", ing:["150g chicken thigh","2 tbsp soy sauce","2 tbsp vinegar","3 cloves garlic","3/4 cup garlic rice","atsara (pickled papaya) to serve"],
          steps:["Simmer chicken with soy sauce, vinegar and garlic 25 min until tender.","Reduce sauce until thickened.","Serve over garlic rice with atsara on the side."]}},
      {n:"Beef kaldereta, steamed rice", kcal:580, p:36, c:58, f:22, cui:["ph"], sf:false,
        recipe:{serves:1, time:"45 min", ing:["150g beef chunks","1/2 cup tomato sauce","1/2 cup diced potato & carrot","3/4 cup steamed rice"],
          steps:["Brown the beef, then simmer in tomato sauce with water until tender, about 30 min.","Add potato and carrot, cook until soft.","Serve over rice."]}},
      {n:"Pork sinigang, steamed rice", kcal:520, p:32, c:52, f:18, cui:["ph"], sf:false,
        recipe:{serves:1, time:"40 min", ing:["150g pork ribs or belly","1 packet sinigang (tamarind) mix or fresh tamarind","mixed vegetables (kangkong, radish, eggplant)","3/4 cup steamed rice"],
          steps:["Simmer pork in water until tender, about 25 min.","Add tamarind base and vegetables, simmer until cooked.","Serve hot with rice."]}},
      {n:"Ginisang monggo with rice", kcal:460, p:22, c:64, f:10, cui:["ph","halal","kosher"], sf:false,
        recipe:{serves:1, time:"30 min", ing:["1/2 cup mung beans","1 cup vegetable or chicken broth","1 cup spinach or malunggay leaves","3/4 cup steamed rice"],
          steps:["Simmer mung beans in broth until soft, about 20 min.","Stir in greens until wilted.","Serve over rice."]}},
      {n:"Pork bicol express, steamed rice", kcal:570, p:30, c:50, f:26, cui:["ph"], sf:false,
        recipe:{serves:1, time:"30 min", ing:["150g pork belly, sliced thin","1/2 cup coconut milk","1 tbsp shrimp paste","chili to taste","3/4 cup steamed rice"],
          steps:["Sauté pork until browned.","Add coconut milk and shrimp paste, simmer 15 min until thickened.","Add chili to taste and serve with rice."]}}
    ],
    dinner: [
      {n:"Baked salmon, sweet potato mash, asparagus", kcal:560, p:38, c:44, f:22, cui:["western","kosher"], sf:true,
        recipe:{serves:1, time:"25 min", ing:["150g salmon fillet","1 medium sweet potato","1 cup asparagus","1 tsp olive oil"],
          steps:["Bake salmon at 200°C for 12–15 min.","Boil and mash the sweet potato.","Steam or roast asparagus with olive oil and serve together."]}},
      {n:"Lean beef chili, kidney beans", kcal:540, p:36, c:46, f:20, cui:["western","halal"], sf:false,
        recipe:{serves:1, time:"30 min", ing:["150g lean ground beef","3/4 cup kidney beans","1/2 cup diced tomato","chili spices to taste"],
          steps:["Brown the beef in a pan.","Add tomato, beans and spices, simmer 15–20 min.","Season to taste and serve."]}},
      {n:"Herb-roasted chicken thigh, wild rice, greens", kcal:580, p:40, c:48, f:22, cui:["western","halal"], sf:false,
        recipe:{serves:1, time:"35 min", ing:["2 chicken thighs","1/2 cup wild rice","2 cups leafy greens","mixed herbs & olive oil"],
          steps:["Season chicken with herbs and roast at 200°C for 25 min.","Cook wild rice per package instructions.","Sauté greens briefly and plate together."]}},
      {n:"Baked cod, herbed potatoes, green beans", kcal:500, p:34, c:46, f:14, cui:["western","kosher"], sf:true,
        recipe:{serves:1, time:"30 min", ing:["150g cod fillet","2 medium potatoes, cubed","1 cup green beans","herbs & 1 tsp olive oil"],
          steps:["Roast potatoes with oil and herbs at 200°C, 20 min.","Bake cod alongside for the last 12 min.","Steam green beans and serve together."]}},
      {n:"Grilled steak, roasted brussels sprouts, farro", kcal:600, p:42, c:44, f:24, cui:["western","kosher"], sf:false,
        recipe:{serves:1, time:"25 min", ing:["150g lean steak","1.5 cups brussels sprouts, halved","1/2 cup cooked farro"],
          steps:["Season and grill steak to preference, rest 5 min.","Roast brussels sprouts at 200°C for 18 min.","Slice steak and serve over farro with sprouts."]}},
      {n:"Turkey meatballs, zucchini noodles, marinara", kcal:460, p:36, c:32, f:18, cui:["western","halal"], sf:false,
        recipe:{serves:1, time:"25 min", ing:["150g ground turkey, formed into meatballs","1 cup marinara sauce","1 medium zucchini, spiralized"],
          steps:["Bake or pan-sear meatballs until cooked through, about 15 min.","Simmer in marinara sauce 5 min.","Lightly sauté zucchini noodles and top with meatballs and sauce."]}},
      {n:"Stuffed bell peppers, ground turkey & rice", kcal:490, p:30, c:44, f:18, cui:["western","halal"], sf:false,
        recipe:{serves:1, time:"40 min", ing:["2 bell peppers, halved","120g ground turkey","1/2 cup cooked rice","1/4 cup tomato sauce"],
          steps:["Mix cooked turkey, rice and tomato sauce.","Stuff into pepper halves.","Bake at 190°C for 25 min until peppers soften."]}},
      {n:"Miso-glazed salmon, edamame rice bowl", kcal:550, p:36, c:50, f:20, cui:["asian"], sf:true,
        recipe:{serves:1, time:"20 min", ing:["150g salmon fillet","1 tbsp miso paste & 1 tsp honey","3/4 cup steamed rice","1/2 cup edamame"],
          steps:["Mix miso and honey, brush over salmon.","Broil or bake salmon 10–12 min until glazed.","Serve over rice with edamame."]}},
      {n:"Teriyaki chicken, steamed rice & broccoli", kcal:560, p:38, c:52, f:18, cui:["asian","halal"], sf:false,
        recipe:{serves:1, time:"22 min", ing:["150g chicken thigh","2 tbsp teriyaki sauce","3/4 cup steamed rice","1 cup broccoli"],
          steps:["Pan-sear chicken until cooked through.","Add teriyaki sauce, simmer until glazed.","Steam broccoli and serve with rice."]}},
      {n:"Beef & vegetable stir-fry, egg noodles", kcal:570, p:36, c:56, f:19, cui:["asian","halal"], sf:false,
        recipe:{serves:1, time:"20 min", ing:["150g beef strips","100g egg noodles","1.5 cups mixed stir-fry vegetables","2 tbsp soy-based sauce"],
          steps:["Cook noodles per package, drain.","Stir-fry beef over high heat, remove.","Stir-fry vegetables, return beef and noodles, toss with sauce."]}},
      {n:"Tofu & vegetable curry, basmati rice", kcal:520, p:20, c:64, f:16, cui:["western","asian","halal","kosher"], sf:false,
        recipe:{serves:1, time:"25 min", ing:["150g firm tofu, cubed","1 cup mixed vegetables","3/4 cup coconut curry sauce","3/4 cup basmati rice"],
          steps:["Pan-sear tofu until golden.","Simmer vegetables in curry sauce 10 min, add tofu.","Serve over basmati rice."]}},
      {n:"Sweet & sour chicken, steamed rice", kcal:540, p:34, c:58, f:14, cui:["asian","halal"], sf:false,
        recipe:{serves:1, time:"20 min", ing:["150g chicken breast, cubed","1/2 cup pineapple chunks","1/2 cup bell pepper","3 tbsp sweet & sour sauce","3/4 cup steamed rice"],
          steps:["Pan-sear chicken until cooked through.","Add pepper and pineapple, cook 3 min.","Stir in sauce, simmer until glossy, serve with rice."]}},
      {n:"Grilled bangus, ensaladang talong & rice", kcal:540, p:34, c:48, f:20, cui:["ph"], sf:true,
        recipe:{serves:1, time:"25 min", ing:["1 whole bangus (milkfish), butterflied","1 grilled eggplant","1 chopped tomato & onion","3/4 cup steamed rice"],
          steps:["Grill the bangus until cooked through, about 15 min.","Mash grilled eggplant and mix with tomato and onion for ensaladang talong.","Serve fish and salad with rice."]}},
      {n:"Chicken tinola, steamed rice", kcal:480, p:34, c:44, f:14, cui:["ph","halal"], sf:false,
        recipe:{serves:1, time:"35 min", ing:["150g chicken, cut into pieces","1 cup green papaya, sliced","1 cup chili leaves or spinach","ginger & fish sauce","3/4 cup steamed rice"],
          steps:["Sauté ginger, add chicken and brown lightly.","Add water and simmer 20 min, then add papaya.","Add leafy greens last, cook briefly, serve with rice."]}},
      {n:"Pork menudo, steamed rice", kcal:560, p:32, c:54, f:20, cui:["ph"], sf:false,
        recipe:{serves:1, time:"40 min", ing:["150g pork, cubed","1/2 cup diced potato & carrot","1/2 cup tomato sauce","3/4 cup steamed rice"],
          steps:["Brown pork in a pan.","Add tomato sauce and simmer 20 min until tender.","Add potato and carrot, cook until soft, serve with rice."]}},
      {n:"Laing with grilled chicken, steamed rice", kcal:540, p:30, c:50, f:22, cui:["ph","halal"], sf:false,
        recipe:{serves:1, time:"30 min", ing:["1 cup taro leaves (or substitute collard greens)","3/4 cup coconut milk","120g grilled chicken breast","3/4 cup steamed rice"],
          steps:["Simmer taro leaves in coconut milk over low heat, undisturbed, 20 min.","Season with a little chili and salt.","Serve with grilled chicken and rice."]}},
      {n:"Beef pochero, steamed rice", kcal:560, p:34, c:52, f:20, cui:["ph"], sf:false,
        recipe:{serves:1, time:"40 min", ing:["150g beef chunks","1/2 cup diced potato & plantain","1/2 cup tomato sauce","3/4 cup steamed rice"],
          steps:["Simmer beef in water until tender, about 25 min.","Add tomato sauce, potato and plantain, cook until soft.","Serve over rice."]}},
      {n:"Herb-crusted salmon, roasted potatoes & green beans", kcal:590, p:38, c:42, f:26, cui:["kosher"], sf:true,
        recipe:{serves:1, time:"30 min", ing:["150g salmon fillet","fresh herbs & breadcrumbs","2 medium potatoes, cubed","1 cup green beans"],
          steps:["Press herb-breadcrumb mix onto the salmon.","Roast potatoes at 200°C for 20 min; bake salmon alongside for the last 12 min.","Steam green beans and serve together."]}}
    ]
  };
  var DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  // ---------- filter state ----------
  var activeCuisines = [];   // empty = no cuisine filter (full mix)
  var seafoodFree = false;

  $("cuisine-chips").addEventListener("click", function(e){
    var btn = e.target.closest(".cuisine-chip");
    if (!btn) return;
    var c = btn.getAttribute("data-cuisine");
    btn.classList.toggle("active");
    var idx = activeCuisines.indexOf(c);
    if (idx === -1) activeCuisines.push(c); else activeCuisines.splice(idx,1);
  });
  $("diet-chips").addEventListener("click", function(e){
    var btn = e.target.closest(".diet-chip");
    if (!btn) return;
    btn.classList.toggle("active");
    seafoodFree = btn.classList.contains("active");
  });

  function filterMeals(list){
    var out = list.filter(function(m){
      if (seafoodFree && m.sf) return false;
      if (activeCuisines.length === 0) return true;
      return activeCuisines.some(function(c){ return m.cui.indexOf(c) !== -1; });
    });
    // fall back to the seafood-free-only filter (ignore cuisine) if the combo is too narrow,
    // then to the full list, so the plan always has enough variety to fill 7 days
    if (out.length < 3){
      out = list.filter(function(m){ return !seafoodFree || !m.sf; });
    }
    if (out.length < 3) out = list;
    return out;
  }

  function shuffle(arr){
    var a = arr.slice();
    for (var i=a.length-1; i>0; i--){
      var j = Math.floor(Math.random()*(i+1));
      var t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  function pick7(list){
    // returns 7 items, cycling with reshuffle if fewer than 7 available
    var pool = shuffle(list);
    var out = [];
    for (var i=0;i<7;i++){
      if (i>0 && i % pool.length === 0) pool = shuffle(list);
      out.push(pool[i % pool.length]);
    }
    return out;
  }

  var lastTargetKcal = 2000;
  var lastMacros = {p:150,c:200,f:60};
  var lastPlanDays = [];      // [{name, meals:[{slot,item,k,p,c,f}], dayKcal,dayP,dayC,dayF}]
  var lastReportMeta = {};    // {bmi, bmiCat, tdee, target, weeks, pace}

  function chooseDayMeals(targetKcal, macroGuide, pools, priorNames){
    var best = null;
    for (var attempt=0; attempt<900; attempt++){
      var meals = [
        {slot:"Breakfast", m:pools[0][Math.floor(Math.random()*pools[0].length)]},
        {slot:"Lunch", m:pools[1][Math.floor(Math.random()*pools[1].length)]},
        {slot:"Dinner", m:pools[2][Math.floor(Math.random()*pools[2].length)]}
      ];
      var rawTotal = meals.reduce(function(sum,x){ return sum+x.m.kcal; },0);
      var scale = targetKcal/rawTotal;
      var totals = meals.reduce(function(t,x){
        t.p += x.m.p*scale; t.c += x.m.c*scale; t.f += x.m.f*scale;
        return t;
      },{p:0,c:0,f:0});
      var repeatPenalty = meals.reduce(function(sum,x){ return sum+(priorNames[x.m.n]||0)*0.08; },0);
      var score = Math.pow((totals.p-macroGuide.p)/macroGuide.p,2) +
        Math.pow((totals.c-macroGuide.c)/macroGuide.c,2) +
        Math.pow((totals.f-macroGuide.f)/macroGuide.f,2) + repeatPenalty;
      if (!best || score<best.score) best={meals:meals,scale:scale,score:score};
    }
    return best;
  }

  function buildPlan(targetKcal, macros){
    var pools = [filterMeals(MEALS.breakfast),filterMeals(MEALS.lunch),filterMeals(MEALS.dinner)];

    var grid = $("day-grid");
    var selector = $("day-selector");
    grid.innerHTML = "";
    selector.innerHTML = "";
    lastPlanDays = [];
    var priorNames = {};

    for (var d=0; d<7; d++){
      var choice = chooseDayMeals(targetKcal,macros,pools,priorNames);
      var meals = choice.meals;
      var scale = choice.scale;

      var dayKcal = 0, dayP = 0, dayC = 0, dayF = 0;
      var dayRecord = {name: DAY_NAMES[d], meals: []};

      var card = document.createElement("div");
      card.className = "day-card" + (d===0 ? " active" : "");
      card.id = "day-panel-" + d;
      card.setAttribute("role", "tabpanel");
      card.setAttribute("aria-labelledby", "day-tab-" + d);
      card.hidden = d !== 0;

      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "day-tab" + (d===0 ? " active" : "");
      tab.id = "day-tab-" + d;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", d===0 ? "true" : "false");
      tab.setAttribute("aria-controls", card.id);
      tab.setAttribute("tabindex", d===0 ? "0" : "-1");
      tab.setAttribute("data-day", d);
      tab.textContent = DAY_NAMES[d].slice(0,3);
      selector.appendChild(tab);

      var head = document.createElement("div");
      head.className = "day-card-head";
      head.innerHTML = '<span class="dname">'+DAY_NAMES[d]+'</span><span class="dkcal">~'+Math.round(targetKcal)+' kcal</span>';
      card.appendChild(head);

      meals.forEach(function(item){
        var k = Math.round(item.m.kcal * scale);
        var p = Math.round(item.m.p * scale);
        var c = Math.round(item.m.c * scale);
        var f = Math.round(item.m.f * scale);
        dayKcal += k; dayP += p; dayC += c; dayF += f;
        dayRecord.meals.push({slot:item.slot, item:item.m, k:k, p:p, c:c, f:f, scale:scale});
        priorNames[item.m.n] = (priorNames[item.m.n]||0)+1;

        var row = document.createElement("div");
        row.className = "meal-row";
        row.innerHTML =
          '<div class="meal-slot">'+item.slot+'</div>' +
          '<div class="meal-name">'+item.m.n+'</div>' +
          '<div class="meal-macros"><span>'+k+' kcal</span><span>P '+p+'g</span><span>C '+c+'g</span><span>F '+f+'g</span></div>';
        card.appendChild(row);
      });

      dayRecord.dayKcal = dayKcal; dayRecord.dayP = dayP; dayRecord.dayC = dayC; dayRecord.dayF = dayF;
      lastPlanDays.push(dayRecord);

      var foot = document.createElement("div");
      foot.className = "day-card-foot";
      foot.innerHTML = '<span>Day total</span><span><b>'+dayKcal+'</b> kcal · P'+dayP+' C'+dayC+' F'+dayF+'</span>';
      card.appendChild(foot);

      grid.appendChild(card);
    }

    var cuisineLabels = {western:"Western", asian:"Asian", ph:"PH local", halal:"Halal", kosher:"Kosher"};
    var filterBits = activeCuisines.map(function(c){ return cuisineLabels[c]; });
    if (seafoodFree) filterBits.push("seafood-free");
    var filterNote = filterBits.length ? " · " + filterBits.join(", ") : "";
    var avg = lastPlanDays.reduce(function(t,day){
      t.p+=day.dayP; t.c+=day.dayC; t.f+=day.dayF; return t;
    },{p:0,c:0,f:0});
    $("plan-sub").textContent = "Estimated daily average: " + Math.round(targetKcal) + " kcal · P " + Math.round(avg.p/7) + "g · C " + Math.round(avg.c/7) + "g · F " + Math.round(avg.f/7) + "g" + filterNote;
  }

  function selectDayTab(tab, moveFocus){
    var day = tab.getAttribute("data-day");
    document.querySelectorAll(".day-tab").forEach(function(option){
      var selected = option === tab;
      option.classList.toggle("active", selected);
      option.setAttribute("aria-selected", selected ? "true" : "false");
      option.setAttribute("tabindex", selected ? "0" : "-1");
    });
    document.querySelectorAll(".day-card").forEach(function(card){
      var selected = card.id === "day-panel-" + day;
      card.classList.toggle("active", selected);
      card.hidden = !selected;
    });
    if (moveFocus) tab.focus();
  }

  $("day-selector").addEventListener("click", function(event){
    var tab = event.target.closest(".day-tab");
    if (!tab) return;
    selectDayTab(tab, false);
  });

  $("day-selector").addEventListener("keydown", function(event){
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".day-tab"));
    var current = tabs.indexOf(document.activeElement);
    if (current < 0) current = 0;
    var next = current;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else next = (current + 1) % tabs.length;
    event.preventDefault();
    selectDayTab(tabs[next], true);
  });

  // ---------- Grocery list (aggregated from the week's ingredients) ----------
  var GROCERY_CATEGORIES = [
    {key:"produce", label:"Produce", test:/spinach|kale|greens|lettuce|tomato|onion|garlic|ginger|pepper|zucchini|broccoli|cauliflower|carrot|celery|potato|sweet potato|avocado|banana|mango|pineapple|berries|lemon|lime|cucumber|eggplant|talong|papaya|scallion|bok choy|brussels sprouts|asparagus|kimchi|bean sprouts|plantain|radish|kangkong|taro|malunggay|chili/i},
    {key:"protein", label:"Meat, Poultry & Eggs", test:/chicken|beef|pork|turkey|egg|steak|tocino|bangus|salmon|cod|shrimp|tuna|tofu|bacon/i},
    {key:"dairy", label:"Dairy & Alternatives", test:/yogurt|cheese|feta|milk|cottage cheese|kesong puti|butter/i},
    {key:"pantry", label:"Grains, Pantry & Canned", test:/rice|oats|quinoa|noodles|bread|tortilla|pandesal|farro|bulgur|beans|lentil|chickpea|tahini|peanut butter|soy sauce|vinegar|broth|sauce|cocoa|sugar|honey|olive oil|sesame oil|coconut milk|spice|curry|tikka|marinade|teriyaki|shrimp paste|dressing|salsa|olives|breadcrumbs|sago|arnibal|tamarind|herbs|paprika|cumin|turmeric/i}
  ];
  function categorize(ing){
    for (var i=0;i<GROCERY_CATEGORIES.length;i++){
      if (GROCERY_CATEGORIES[i].test.test(ing)) return GROCERY_CATEGORIES[i].key;
    }
    return "other";
  }
  function numberFromText(value){
    var bits=value.trim().split(/\s+/), total=0;
    bits.forEach(function(bit){
      if (bit.indexOf("/")>-1){ var f=bit.split("/"); total+=parseFloat(f[0])/parseFloat(f[1]); }
      else total+=parseFloat(bit);
    });
    return total;
  }
  function formatQty(value){
    if (Math.abs(value-Math.round(value))<0.01) return String(Math.round(value));
    return String(Math.round(value*100)/100);
  }
  // Parse measurable leading quantities while retaining free-text ingredients as "as needed".
  function splitQty(ing){
    var m=ing.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(kg|g|ml|l|cups?|tbsp|tsp|pieces?|slices?|cans?|whole|cloves?|medium|large|small|scoops?|packets?|rolls?|balls?)?\s+(.+)$/i);
    if (!m) return {qty:null,unit:"",name:ing.trim()};
    return {qty:numberFromText(m[1]),unit:(m[2]||"").toLowerCase(),name:m[3].trim()};
  }
  function scaledIngredient(ing,scale){
    var part=splitQty(ing);
    if (part.qty===null) return ing;
    return formatQty(part.qty*scale)+(part.unit ? " "+part.unit : "")+" "+part.name;
  }
  function buildGroceryList(){
    var groups = {};
    lastPlanDays.forEach(function(day){
      day.meals.forEach(function(x){
        var meal = x.item;
        if (!meal.recipe) return;
        meal.recipe.ing.forEach(function(ing){
          var parts = splitQty(ing);
          var key = categorize(ing);
          var nameKey = parts.name.toLowerCase()+"|"+parts.unit;
          groups[key] = groups[key] || {};
          groups[key][nameKey] = groups[key][nameKey] || {label:parts.name,unit:parts.unit,qty:0,uses:0,measured:parts.qty!==null};
          groups[key][nameKey].uses++;
          if (parts.qty!==null) groups[key][nameKey].qty += parts.qty*x.scale;
        });
      });
    });
    return groups;
  }

  // ---------- PDF report (real downloadable file, phone-width layout) ----------
  function escHtml(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function buildPrintReport(){
    var m = lastReportMeta;
    var html = "";

    html += '<div class="pr-brand-strip"><b>KELBRIC TECHNOLOGIES</b><span>github.com/kelbrictech</span></div>';

    html += '<div class="pr-mast">' +
      '<div class="pr-wordmark"><span class="pr-brand-fit">Fit</span><span class="pr-brand-rest">inerary</span></div>' +
      '<p class="pr-eyebrow">Your personal diet planner</p>' +
      '<h1 class="pr-title">7-Day Nutrition Plan</h1>' +
      '<p class="pr-sub">Generated ' + new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}) + '</p>' +
      '</div>';

    html += '<div class="pr-stats">' +
      '<div class="pr-stat"><span class="l">BMI screening estimate</span><span class="v">' + m.bmi + ' (' + escHtml(m.bmiCat) + ')</span></div>' +
      '<div class="pr-stat"><span class="l">Estimated maintenance</span><span class="v">' + m.tdee + ' kcal</span></div>' +
      '<div class="pr-stat"><span class="l">Estimated daily target</span><span class="v">' + m.target + ' kcal</span></div>' +
      '<div class="pr-stat"><span class="l">Planned weekly change</span><span class="v">' + escHtml(m.changeLabel) + '</span></div>' +
      '<div class="pr-stat" style="grid-column:1 / -1;"><span class="l">Macro planning guide</span><span class="v">Protein ' + lastMacros.p + 'g · Carbs ' + lastMacros.c + 'g · Fat ' + lastMacros.f + 'g</span></div>' +
      '</div>';

    html += '<div class="pr-section-title">7-day meal plan</div>';
    lastPlanDays.forEach(function(day){
      html += '<div class="pr-day"><div class="pr-day-head"><span>' + day.name + '</span><span>' + day.dayKcal + ' kcal</span></div>';
      day.meals.forEach(function(x){
        html += '<div class="pr-meal"><span class="slot">' + x.slot + '</span><div class="name">' + escHtml(x.item.n) + '</div><div class="macros">' + x.k + ' kcal · P ' + x.p + 'g · C ' + x.c + 'g · F ' + x.f + 'g</div></div>';
      });
      html += '</div>';
    });

    // ---- grocery list ----
    html += '<div class="pr-section-title">Grocery list</div>';
    var groups = buildGroceryList();
    var order = ["produce","protein","dairy","pantry","other"];
    var labels = {produce:"Produce", protein:"Meat, Poultry & Eggs", dairy:"Dairy & Alternatives", pantry:"Grains, Pantry & Canned", other:"Other"};
    html += '<div class="pr-grocery">';
    order.forEach(function(key){
      var g = groups[key];
      if (!g) return;
      var names = Object.keys(g).sort();
      if (!names.length) return;
      html += '<div class="pr-grocery-group"><h5>' + labels[key] + '</h5><ul>';
      names.forEach(function(n){
        var entry = g[n];
        var qtyText = entry.measured ? formatQty(entry.qty)+(entry.unit ? " "+entry.unit : "") : "as needed"+(entry.uses>1 ? " · "+entry.uses+" meals" : "");
        html += '<li><span class="box"></span>' + escHtml(entry.label) + (qtyText ? '<span class="qty">' + escHtml(qtyText) + '</span>' : '') + '</li>';
      });
      html += '</ul></div>';
    });
    html += '</div>';
    html += '<p class="pr-foot">Measured grocery quantities are summed across all 21 scaled meal portions, including repeated meals. “As needed” marks ingredients whose source recipe does not specify an amount. Round purchases up to practical pack sizes.</p>';

    html += '<div class="pr-section-title">Recipe guide</div>';
    lastPlanDays.forEach(function(day){
      day.meals.forEach(function(x){
        var r=x.item.recipe;
        if (!r) return;
        html += '<div class="pr-recipe">' +
          '<h4>' + escHtml(x.item.n) + '</h4>' +
          '<div class="meta">' + day.name + ' · ' + x.slot + ' · ' + x.k + ' kcal estimated · portion ×' + x.scale.toFixed(2) + '</div>' +
          '<h5>Scaled ingredients</h5><ul>' + r.ing.map(function(i){ return '<li>' + escHtml(scaledIngredient(i,x.scale)) + '</li>'; }).join("") + '</ul>' +
          '<h5>Steps</h5><ol>' + r.steps.map(function(s){ return '<li>' + escHtml(s) + '</li>'; }).join("") + '</ol>' +
        '</div>';
      });
    });

    html += '<p class="pr-foot">For adults 18+. BMI is a screening estimate, not a diagnosis. Weight-loss targets cannot go below BMI 18.5 and weight-gain targets cannot go above BMI 24.9 in this general planner. Maintenance calories use the Mifflin–St Jeor equation plus a selected activity factor; actual needs vary. Loss plans use an estimated calorie deficit and gain plans use an estimated surplus capped at 20% of maintenance or 500 kcal/day, whichever is lower. Scale-weight change is not linear and may reflect water, fat and lean tissue. Meal nutrition is estimated from the built-in recipe set and will vary by brand, cooked yield and preparation. The planner does not generate loss targets below 1,200 kcal/day for women or 1,500 kcal/day for men, but those limits do not establish medical safety for an individual. Halal and kosher tags describe ingredient screening only, not certification. Consult a qualified clinician or dietitian for individual advice.</p>';

    html += '<div class="pr-foot-brand">All rights reserved.</div>';

    $("print-report").innerHTML = html;
  }

  function setPdfStatus(message, tone){
    var status = $("pdf-status");
    status.textContent = message || "";
    status.className = "pdf-status" + (tone ? " " + tone : "");
    status.hidden = !message;
    status.setAttribute("role", tone === "error" ? "alert" : "status");
    status.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
  }

  function setPdfBtnState(busy){
    var btn = $("pdf-btn");
    btn.disabled = busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
    btn.querySelector(".pdf-download-icon").hidden = busy;
    btn.querySelector(".pdf-spinner").hidden = !busy;
    btn.querySelector(".pdf-btn-label").textContent = busy ? "Preparing PDF…" : "Download full plan";
  }

  $("pdf-btn").addEventListener("click", function(){
    setPdfStatus("", "");
    if (typeof html2canvas === "undefined" || !window.jspdf){
      setPdfStatus("We couldn’t create your PDF because the download tools did not load. Check your connection and try again.", "error");
      return;
    }
    setPdfBtnState(true);
    try{
      buildPrintReport();
    } catch(err){
      console.error(err);
      setPdfBtnState(false);
      setPdfStatus("We couldn’t prepare your PDF. Please try again.", "error");
      return;
    }

    var node = $("print-report");
    // let the browser lay out the off-canvas node before capturing it
    window.setTimeout(function(){
      html2canvas(node, {scale:2, backgroundColor:"#FBF8F0", windowWidth:390}).then(function(canvas){
        var jsPDF = window.jspdf.jsPDF;
        var pageWidthMm = 100;               // narrow, phone-proportioned page
        var pageHeightMm = pageWidthMm * (canvas.height / canvas.width);
        var pdf = new jsPDF({ unit:"mm", format:[pageWidthMm, pageHeightMm] });
        var imgData = canvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, pageHeightMm);
        pdf.save("fitinerary-7-day-plan.pdf");
        setPdfStatus("Your Fitinerary PDF has been downloaded.", "success");
      }).catch(function(err){
        console.error(err);
        setPdfStatus("We couldn’t create your PDF. Please try again.", "error");
      }).finally(function(){
        setPdfBtnState(false);
      });
    }, 50);
  });

  $("regen-btn").addEventListener("click", function(){
    setPdfStatus("", "");
    buildPlan(lastTargetKcal, lastMacros);
  });

  // ---------- calculation ----------
  function classifyBMI(bmi){
    if (bmi < 18.5) return {label:"Underweight", color:"#426B8E", bg:"#E3ECF4"};
    if (bmi < 25) return {label:"Healthy", color:"var(--sage-ink)", bg:"var(--sage-tint)"};
    if (bmi < 30) return {label:"Overweight", color:"var(--coral-ink)", bg:"var(--coral-tint)"};
    return {label:"Obesity", color:"var(--danger)", bg:"var(--coral-tint)"};
  }

  function tdeeFor(weightKg, heightCm, age, activity){
    var bmr = sex==="m"
      ? (10*weightKg + 6.25*heightCm - 5*age + 5)
      : (10*weightKg + 6.25*heightCm - 5*age - 161);
    return bmr * activity;
  }

  var lastHeightCm = 0, lastWeightKg = 0, lastAge = 30, lastActivity = 1.375;

  // ---------- Step 1: BMI & recommended weight ----------
  $("step1-btn").addEventListener("click", function(){
    setFormError("step1-error", "");
    var age = parseFloat($("age").value);
    var heightCm = getHeightCm();
    var weightKg = getWeightKg();
    var activity = parseFloat($("activity").value);

    if (!Number.isFinite(age) || age < 18 || age > 90){
      setFormError("step1-error", "Enter an age from 18 to 90. Fitinerary currently supports adults only.");
      return;
    }
    if (!Number.isFinite(heightCm) || heightCm < 90 || heightCm > 230){
      setFormError("step1-error", "Enter a height from 90 to 230 cm (about 2 ft 11 in to 7 ft 7 in).");
      return;
    }
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 250){
      setFormError("step1-error", "Enter a current weight from 20 to 250 kg (about 44 to 551 lb).");
      return;
    }

    lastHeightCm = heightCm; lastWeightKg = weightKg; lastAge = age; lastActivity = activity;

    var heightM = heightCm/100;
    var bmi = weightKg / (heightM*heightM);
    var cat = classifyBMI(bmi);
    var tdee = tdeeFor(weightKg, heightCm, age, activity);

    // healthy BMI range 18.5–24.9 translated to a weight range for this height
    var rangeLowKg = 18.5 * heightM * heightM;
    var rangeHighKg = 24.9 * heightM * heightM;
    var midpointKg = (rangeLowKg + rangeHighKg) / 2;

    // ---- render step 1 dashboard ----
    $("bmi-value").textContent = bmi.toFixed(1);
    var bmiCat = $("bmi-cat");
    bmiCat.textContent = cat.label;
    bmiCat.style.background = cat.bg;
    bmiCat.style.color = cat.color;

    var pct = Math.min(100, Math.max(0, ((bmi-15)/(40-15))*100));
    $("bmi-marker").style.left = pct + "%";
    $("bmi-marker").style.background = cat.color;

    var warnEl = $("bmi-warn");
    if (bmi < 18.5){
      warnEl.hidden = false;
      warnEl.innerHTML = "<strong>Note —</strong> your BMI is already in the underweight range. Consider speaking with a clinician before pursuing further weight change.";
    } else {
      warnEl.hidden = true;
    }

    $("stat-range").textContent = round1(rangeLowKg) + "–" + round1(rangeHighKg) + " kg";
    $("stat-midpoint").textContent = round1(midpointKg) + " kg";
    $("stat-tdee").textContent = Math.round(tdee).toLocaleString() + " kcal";

    // pre-fill step 2's target weight with the recommended midpoint
    $("target-kg").value = round1(midpointKg);
    $("target-lb").value = round1(midpointKg / 0.453592);

    $("step1-results").hidden = false;
    $("step2-card").hidden = false;
    $("step1-card").hidden = true;
    $("results").hidden = true;
    setProgress(2);
    $("step1-results").scrollIntoView({behavior:"smooth", block:"start"});
  });

  // ---------- Step 2: target weight → meal plan ----------
  $("calc-btn").addEventListener("click", function(){
    setFormError("step2-error", "");
    var targetKg = getTargetKg();
    if (!lastHeightCm || !lastWeightKg){
      setFormError("step2-error", "Return to step 1 and enter your starting numbers first.");
      return;
    }
    if (!Number.isFinite(targetKg) || targetKg < 20 || targetKg > 250){
      setFormError("step2-error", "Enter a target weight from 20 to 250 kg (about 44 to 551 lb).");
      return;
    }

    var heightCm = lastHeightCm, weightKg = lastWeightKg, age = lastAge, activity = lastActivity;
    var pace = parseFloat($("pace").value);

    var heightM = heightCm/100;
    var targetBmi = targetKg / (heightM*heightM);
    var tdee = tdeeFor(weightKg, heightCm, age, activity);
    var deltaKg = targetKg - weightKg;
    var goal = Math.abs(deltaKg) < 0.05 ? "maintain" : (deltaKg > 0 ? "gain" : "loss");
    var changeKg = Math.abs(deltaKg);
    var targetWarnEl = $("target-warn");
    if (goal === "loss" && targetBmi < 18.5){
      targetWarnEl.hidden = true;
      setFormError("step2-error", "That target is below the general adult BMI reference range. Choose at least " + round1(18.5 * heightM * heightM) + " kg, or ask a qualified clinician or dietitian for an individual plan.");
      $("results").hidden = true;
      return;
    }
    if (goal === "gain" && targetBmi > 24.9){
      targetWarnEl.hidden = true;
      setFormError("step2-error", "That gain target is above the general adult healthy BMI reference range. Choose no more than " + round1(24.9 * heightM * heightM) + " kg, or ask a qualified clinician or dietitian for an individual plan.");
      $("results").hidden = true;
      return;
    }

    // Pace-to-energy conversion is only a planning estimate; real weight change is not linear.
    var requestedDailyChange = (pace * 7700) / 7;
    var floor = sex==="m" ? 1500 : 1200;
    var gainSurplusLimit = Math.min(500, tdee * 0.20);
    var appliedChange = 0;
    var targetKcal = tdee;
    var cappedNote = false;

    if (goal === "loss"){
      targetKcal = Math.max(floor, tdee - requestedDailyChange);
      appliedChange = tdee - targetKcal;
      cappedNote = appliedChange < requestedDailyChange - 5;
    } else if (goal === "gain"){
      appliedChange = Math.min(requestedDailyChange, gainSurplusLimit);
      targetKcal = tdee + appliedChange;
      cappedNote = appliedChange < requestedDailyChange - 5;
    }

    var weeks = changeKg > 0 && appliedChange > 0
      ? (changeKg * 7700) / (appliedChange * 7)
      : 0;

    // Goal-specific planning guides remain within the adult AMDR ranges.
    var macroRatios = goal === "loss"
      ? {p:0.30, c:0.45, f:0.25}
      : goal === "gain"
        ? {p:0.25, c:0.50, f:0.25}
        : {p:0.25, c:0.45, f:0.30};
    var proteinG = Math.round((targetKcal*macroRatios.p)/4);
    var carbsG = Math.round((targetKcal*macroRatios.c)/4);
    var fatG = Math.round((targetKcal*macroRatios.f)/9);
    var goalLabel = goal === "gain" ? "Weight gain" : (goal === "loss" ? "Weight loss" : "Maintenance");
    var effectivePace = appliedChange > 0 ? Math.round(((appliedChange * 7) / 7700) * 100) / 100 : 0;
    var changeLabel = goal === "maintain" ? "Maintenance" : goalLabel + " · ~" + effectivePace + " kg/wk";

    lastTargetKcal = targetKcal;
    lastMacros = {p:proteinG, c:carbsG, f:fatG};
    lastReportMeta = {
      bmi: (weightKg / (heightM*heightM)).toFixed(1),
      bmiCat: classifyBMI(weightKg / (heightM*heightM)).label,
      tdee: Math.round(tdee).toLocaleString(),
      target: Math.round(targetKcal).toLocaleString(),
      weeks: weeks > 0 ? Math.ceil(weeks) : null,
      pace: goal === "maintain" ? null : pace,
      goal: goal,
      changeLabel: changeLabel
    };

    // ---- render step 2 dashboard ----
    $("stat-tdee2").textContent = Math.round(tdee).toLocaleString() + " kcal";
    $("stat-pace").textContent = changeLabel;
    $("stat-target").textContent = Math.round(targetKcal).toLocaleString() + " kcal";
    $("stat-weeks").textContent = weeks > 0 ? Math.ceil(weeks) + " wk" : "—";

    $("macro-p").textContent = proteinG;
    $("macro-c").textContent = carbsG;
    $("macro-f").textContent = fatG;
    $("macro-guide-note").textContent = goalLabel + " macro guide (" + Math.round(macroRatios.p*100) + "% protein / " + Math.round(macroRatios.c*100) + "% carbohydrate / " + Math.round(macroRatios.f*100) + "% fat); generated meals show their estimated actual average.";

    $("stat-current-w").textContent = round1(weightKg) + " kg";
    $("stat-target-w").textContent = round1(targetKg) + " kg";
    $("stat-target-bmi").textContent = targetBmi.toFixed(1) + " (" + classifyBMI(targetBmi).label + ")";

    if (goal === "maintain"){
      targetWarnEl.hidden = false;
      targetWarnEl.innerHTML = "<strong>Maintenance plan —</strong> your target equals your current weight, so no calorie deficit was applied.";
    } else if (goal === "loss" && cappedNote){
      targetWarnEl.hidden = false;
      targetWarnEl.innerHTML = "<strong>Pace capped —</strong> your requested deficit would drop intake below this planner’s lower limit (" + floor + " kcal/day), so the estimate was raised to that limit. This limit is not an individual medical-safety determination.";
    } else if (goal === "gain" && cappedNote){
      targetWarnEl.hidden = false;
      targetWarnEl.innerHTML = "<strong>Gain pace adjusted —</strong> this plan adds about " + Math.round(appliedChange) + " kcal/day above estimated maintenance, capped at 20% of maintenance or 500 kcal/day, whichever is lower. Actual gain and body composition vary.";
    } else if (goal === "gain"){
      targetWarnEl.hidden = false;
      targetWarnEl.innerHTML = "<strong>Weight-gain plan —</strong> this estimate adds about " + Math.round(appliedChange) + " kcal/day above maintenance. Actual gain and body composition vary; resistance training and qualified guidance can help align the plan with a muscle-gain goal.";
    } else {
      targetWarnEl.hidden = true;
    }

    $("results").hidden = false;
    setPdfStatus("", "");
    buildPlan(targetKcal, lastMacros);
    $("step1-results").hidden = true;
    $("step2-card").hidden = true;
    setProgress(3);
    $("results").scrollIntoView({behavior:"smooth", block:"start"});
  });

  $("edit-numbers-btn").addEventListener("click", function(){
    $("step1-card").hidden = false;
    $("step1-results").hidden = true;
    $("step2-card").hidden = true;
    $("results").hidden = true;
    setProgress(1);
    $("step1-card").scrollIntoView({behavior:"smooth",block:"start"});
  });

  $("edit-plan-btn").addEventListener("click", function(){
    $("step1-results").hidden = false;
    $("step2-card").hidden = false;
    $("results").hidden = true;
    setProgress(2);
    $("step1-results").scrollIntoView({behavior:"smooth",block:"start"});
  });

})();
