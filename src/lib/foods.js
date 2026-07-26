// Per-100g macros for common whole foods, USDA-derived.
//
// `units` gives conventional weights for count and volume measures where a
// density calculation would be wrong — a cup of spinach is 30 g, not 237 g.
// `g_per_ml` is the fallback for liquids. Values are for the raw/uncooked form
// unless `note` says otherwise, because that is how people describe what they
// cooked with ("one chicken breast", not "140 g cooked chicken").
//
// This is a .js module rather than .json so Node and Vite import it the same
// way, with no import attributes.

export const FOODS = [
  {
    "id": "apple",
    "name": "apple",
    "aliases": [
      "apples"
    ],
    "per100g": {
      "kcal": 52,
      "protein": 0.26,
      "carb": 13.8,
      "fat": 0.17,
      "fiber": 2.4
    },
    "units": {
      "each": 182,
      "medium": 182,
      "large": 223,
      "small": 149,
      "cup": 125
    }
  },
  {
    "id": "banana",
    "name": "banana",
    "aliases": [
      "bananas"
    ],
    "per100g": {
      "kcal": 89,
      "protein": 1.09,
      "carb": 22.8,
      "fat": 0.33,
      "fiber": 2.6
    },
    "units": {
      "each": 118,
      "medium": 118,
      "large": 136,
      "small": 101,
      "cup": 150
    }
  },
  {
    "id": "blueberries",
    "name": "blueberries",
    "aliases": [
      "blueberry"
    ],
    "per100g": {
      "kcal": 57,
      "protein": 0.74,
      "carb": 14.5,
      "fat": 0.33,
      "fiber": 2.4
    },
    "units": {
      "cup": 148
    }
  },
  {
    "id": "raspberries",
    "name": "raspberries",
    "aliases": [
      "raspberry",
      "red raspberries"
    ],
    "per100g": {
      "kcal": 52,
      "protein": 1.2,
      "carb": 11.9,
      "fat": 0.65,
      "fiber": 6.5
    },
    "units": {
      "cup": 123
    }
  },
  {
    "id": "strawberries",
    "name": "strawberries",
    "aliases": [
      "strawberry"
    ],
    "per100g": {
      "kcal": 32,
      "protein": 0.67,
      "carb": 7.68,
      "fat": 0.3,
      "fiber": 2
    },
    "units": {
      "cup": 152,
      "each": 12
    }
  },
  {
    "id": "blackberries",
    "name": "blackberries",
    "aliases": [
      "blackberry"
    ],
    "per100g": {
      "kcal": 43,
      "protein": 1.39,
      "carb": 9.61,
      "fat": 0.49,
      "fiber": 5.3
    },
    "units": {
      "cup": 144
    }
  },
  {
    "id": "orange",
    "name": "orange",
    "aliases": [
      "oranges"
    ],
    "per100g": {
      "kcal": 47,
      "protein": 0.94,
      "carb": 11.8,
      "fat": 0.12,
      "fiber": 2.4
    },
    "units": {
      "each": 131,
      "medium": 131,
      "large": 184
    }
  },
  {
    "id": "grapes",
    "name": "grapes",
    "aliases": [
      "grape"
    ],
    "per100g": {
      "kcal": 69,
      "protein": 0.72,
      "carb": 18.1,
      "fat": 0.16,
      "fiber": 0.9
    },
    "units": {
      "cup": 151
    }
  },
  {
    "id": "mango",
    "name": "mango",
    "aliases": [
      "mangoes"
    ],
    "per100g": {
      "kcal": 60,
      "protein": 0.82,
      "carb": 15,
      "fat": 0.38,
      "fiber": 1.6
    },
    "units": {
      "each": 336,
      "cup": 165
    }
  },
  {
    "id": "pineapple",
    "name": "pineapple",
    "aliases": [],
    "per100g": {
      "kcal": 50,
      "protein": 0.54,
      "carb": 13.1,
      "fat": 0.12,
      "fiber": 1.4
    },
    "units": {
      "cup": 165
    }
  },
  {
    "id": "peach",
    "name": "peach",
    "aliases": [
      "peaches"
    ],
    "per100g": {
      "kcal": 39,
      "protein": 0.91,
      "carb": 9.54,
      "fat": 0.25,
      "fiber": 1.5
    },
    "units": {
      "each": 150,
      "medium": 150
    }
  },
  {
    "id": "pear",
    "name": "pear",
    "aliases": [
      "pears"
    ],
    "per100g": {
      "kcal": 57,
      "protein": 0.36,
      "carb": 15.2,
      "fat": 0.14,
      "fiber": 3.1
    },
    "units": {
      "each": 178,
      "medium": 178
    }
  },
  {
    "id": "watermelon",
    "name": "watermelon",
    "aliases": [],
    "per100g": {
      "kcal": 30,
      "protein": 0.61,
      "carb": 7.55,
      "fat": 0.15,
      "fiber": 0.4
    },
    "units": {
      "cup": 152
    }
  },
  {
    "id": "cantaloupe",
    "name": "cantaloupe",
    "aliases": [
      "melon"
    ],
    "per100g": {
      "kcal": 34,
      "protein": 0.84,
      "carb": 8.16,
      "fat": 0.19,
      "fiber": 0.9
    },
    "units": {
      "cup": 160
    }
  },
  {
    "id": "avocado",
    "name": "avocado",
    "aliases": [
      "avocados"
    ],
    "per100g": {
      "kcal": 160,
      "protein": 2,
      "carb": 8.53,
      "fat": 14.7,
      "fiber": 6.7
    },
    "units": {
      "each": 201,
      "medium": 201,
      "half": 100,
      "cup": 150
    }
  },
  {
    "id": "lemon",
    "name": "lemon",
    "aliases": [
      "lemons",
      "lemon juice"
    ],
    "per100g": {
      "kcal": 29,
      "protein": 1.1,
      "carb": 9.32,
      "fat": 0.3,
      "fiber": 2.8
    },
    "g_per_ml": 1.03,
    "units": {
      "each": 58,
      "tbsp": 15,
      "tsp": 5
    }
  },
  {
    "id": "lime",
    "name": "lime",
    "aliases": [
      "limes",
      "lime juice"
    ],
    "per100g": {
      "kcal": 30,
      "protein": 0.7,
      "carb": 10.5,
      "fat": 0.2,
      "fiber": 2.8
    },
    "g_per_ml": 1.03,
    "units": {
      "each": 67,
      "tbsp": 15,
      "tsp": 5
    }
  },
  {
    "id": "dates",
    "name": "dates",
    "aliases": [
      "date",
      "medjool dates"
    ],
    "per100g": {
      "kcal": 277,
      "protein": 1.81,
      "carb": 75,
      "fat": 0.15,
      "fiber": 6.7
    },
    "units": {
      "each": 24
    }
  },
  {
    "id": "raisins",
    "name": "raisins",
    "aliases": [
      "raisin"
    ],
    "per100g": {
      "kcal": 299,
      "protein": 3.07,
      "carb": 79.2,
      "fat": 0.46,
      "fiber": 3.7
    },
    "units": {
      "cup": 145,
      "tbsp": 9
    }
  },
  {
    "id": "broccoli",
    "name": "broccoli",
    "aliases": [],
    "per100g": {
      "kcal": 34,
      "protein": 2.82,
      "carb": 6.64,
      "fat": 0.37,
      "fiber": 2.6
    },
    "units": {
      "cup": 91,
      "head": 608
    }
  },
  {
    "id": "spinach",
    "name": "spinach",
    "aliases": [
      "baby spinach"
    ],
    "per100g": {
      "kcal": 23,
      "protein": 2.86,
      "carb": 3.63,
      "fat": 0.39,
      "fiber": 2.2
    },
    "units": {
      "cup": 30,
      "handful": 30
    }
  },
  {
    "id": "kale",
    "name": "kale",
    "aliases": [],
    "per100g": {
      "kcal": 49,
      "protein": 4.28,
      "carb": 8.75,
      "fat": 0.93,
      "fiber": 3.6
    },
    "units": {
      "cup": 67
    }
  },
  {
    "id": "lettuce",
    "name": "lettuce",
    "aliases": [
      "romaine",
      "romaine lettuce",
      "mixed greens",
      "salad greens"
    ],
    "per100g": {
      "kcal": 17,
      "protein": 1.23,
      "carb": 3.29,
      "fat": 0.3,
      "fiber": 2.1
    },
    "units": {
      "cup": 47,
      "head": 626
    }
  },
  {
    "id": "bell_pepper",
    "name": "bell pepper",
    "aliases": [
      "bell peppers",
      "red pepper",
      "green pepper",
      "capsicum",
      "sweet pepper"
    ],
    "per100g": {
      "kcal": 26,
      "protein": 0.99,
      "carb": 6.03,
      "fat": 0.3,
      "fiber": 2.1
    },
    "units": {
      "each": 119,
      "medium": 119,
      "large": 164,
      "cup": 149
    }
  },
  {
    "id": "onion",
    "name": "onion",
    "aliases": [
      "onions",
      "yellow onion",
      "white onion",
      "red onion"
    ],
    "per100g": {
      "kcal": 40,
      "protein": 1.1,
      "carb": 9.34,
      "fat": 0.1,
      "fiber": 1.7
    },
    "units": {
      "each": 110,
      "medium": 110,
      "large": 150,
      "small": 70,
      "cup": 160
    }
  },
  {
    "id": "garlic",
    "name": "garlic",
    "aliases": [
      "garlic clove",
      "garlic cloves"
    ],
    "per100g": {
      "kcal": 149,
      "protein": 6.36,
      "carb": 33.1,
      "fat": 0.5,
      "fiber": 2.1
    },
    "units": {
      "clove": 3,
      "each": 3,
      "tsp": 3,
      "tbsp": 8
    }
  },
  {
    "id": "carrot",
    "name": "carrot",
    "aliases": [
      "carrots"
    ],
    "per100g": {
      "kcal": 41,
      "protein": 0.93,
      "carb": 9.58,
      "fat": 0.24,
      "fiber": 2.8
    },
    "units": {
      "each": 61,
      "medium": 61,
      "cup": 128
    }
  },
  {
    "id": "tomato",
    "name": "tomato",
    "aliases": [
      "tomatoes"
    ],
    "per100g": {
      "kcal": 18,
      "protein": 0.88,
      "carb": 3.89,
      "fat": 0.2,
      "fiber": 1.2
    },
    "units": {
      "each": 123,
      "medium": 123,
      "cup": 180
    }
  },
  {
    "id": "cucumber",
    "name": "cucumber",
    "aliases": [
      "cucumbers"
    ],
    "per100g": {
      "kcal": 15,
      "protein": 0.65,
      "carb": 3.63,
      "fat": 0.11,
      "fiber": 0.5
    },
    "units": {
      "each": 301,
      "cup": 119
    }
  },
  {
    "id": "zucchini",
    "name": "zucchini",
    "aliases": [
      "courgette",
      "summer squash"
    ],
    "per100g": {
      "kcal": 17,
      "protein": 1.21,
      "carb": 3.11,
      "fat": 0.32,
      "fiber": 1
    },
    "units": {
      "each": 196,
      "medium": 196,
      "cup": 124
    }
  },
  {
    "id": "mushrooms",
    "name": "mushrooms",
    "aliases": [
      "mushroom",
      "cremini",
      "button mushrooms"
    ],
    "per100g": {
      "kcal": 22,
      "protein": 3.09,
      "carb": 3.26,
      "fat": 0.34,
      "fiber": 1
    },
    "units": {
      "cup": 70,
      "each": 18
    }
  },
  {
    "id": "sweet_potato",
    "name": "sweet potato",
    "aliases": [
      "sweet potatoes",
      "yam"
    ],
    "per100g": {
      "kcal": 86,
      "protein": 1.57,
      "carb": 20.1,
      "fat": 0.05,
      "fiber": 3
    },
    "units": {
      "each": 130,
      "medium": 130,
      "cup": 133
    }
  },
  {
    "id": "potato",
    "name": "potato",
    "aliases": [
      "potatoes",
      "russet potato"
    ],
    "per100g": {
      "kcal": 77,
      "protein": 2.05,
      "carb": 17.5,
      "fat": 0.09,
      "fiber": 2.1
    },
    "units": {
      "each": 173,
      "medium": 173,
      "cup": 150
    }
  },
  {
    "id": "green_beans",
    "name": "green beans",
    "aliases": [
      "string beans",
      "green bean"
    ],
    "per100g": {
      "kcal": 31,
      "protein": 1.83,
      "carb": 6.97,
      "fat": 0.22,
      "fiber": 2.7
    },
    "units": {
      "cup": 100
    }
  },
  {
    "id": "asparagus",
    "name": "asparagus",
    "aliases": [],
    "per100g": {
      "kcal": 20,
      "protein": 2.2,
      "carb": 3.88,
      "fat": 0.12,
      "fiber": 2.1
    },
    "units": {
      "cup": 134,
      "spear": 16
    }
  },
  {
    "id": "cauliflower",
    "name": "cauliflower",
    "aliases": [],
    "per100g": {
      "kcal": 25,
      "protein": 1.92,
      "carb": 4.97,
      "fat": 0.28,
      "fiber": 2
    },
    "units": {
      "cup": 107,
      "head": 588
    }
  },
  {
    "id": "brussels_sprouts",
    "name": "brussels sprouts",
    "aliases": [
      "brussel sprouts"
    ],
    "per100g": {
      "kcal": 43,
      "protein": 3.38,
      "carb": 8.95,
      "fat": 0.3,
      "fiber": 3.8
    },
    "units": {
      "cup": 88
    }
  },
  {
    "id": "cabbage",
    "name": "cabbage",
    "aliases": [],
    "per100g": {
      "kcal": 25,
      "protein": 1.28,
      "carb": 5.8,
      "fat": 0.1,
      "fiber": 2.5
    },
    "units": {
      "cup": 89
    }
  },
  {
    "id": "celery",
    "name": "celery",
    "aliases": [],
    "per100g": {
      "kcal": 14,
      "protein": 0.69,
      "carb": 2.97,
      "fat": 0.17,
      "fiber": 1.6
    },
    "units": {
      "stalk": 40,
      "each": 40,
      "cup": 101
    }
  },
  {
    "id": "corn",
    "name": "corn",
    "aliases": [
      "sweet corn",
      "corn kernels"
    ],
    "per100g": {
      "kcal": 86,
      "protein": 3.27,
      "carb": 18.7,
      "fat": 1.35,
      "fiber": 2
    },
    "units": {
      "cup": 145,
      "ear": 90
    }
  },
  {
    "id": "peas",
    "name": "peas",
    "aliases": [
      "green peas"
    ],
    "per100g": {
      "kcal": 81,
      "protein": 5.42,
      "carb": 14.5,
      "fat": 0.4,
      "fiber": 5.7
    },
    "units": {
      "cup": 145
    }
  },
  {
    "id": "snap_peas",
    "name": "snap peas",
    "aliases": [
      "sugar snap peas",
      "snow peas"
    ],
    "per100g": {
      "kcal": 42,
      "protein": 2.8,
      "carb": 7.55,
      "fat": 0.2,
      "fiber": 2.6
    },
    "units": {
      "cup": 63
    }
  },
  {
    "id": "ginger",
    "name": "ginger",
    "aliases": [
      "fresh ginger"
    ],
    "per100g": {
      "kcal": 80,
      "protein": 1.82,
      "carb": 17.8,
      "fat": 0.75,
      "fiber": 2
    },
    "units": {
      "tsp": 2,
      "tbsp": 6
    }
  },
  {
    "id": "scallion",
    "name": "scallion",
    "aliases": [
      "green onion",
      "green onions",
      "scallions"
    ],
    "per100g": {
      "kcal": 32,
      "protein": 1.83,
      "carb": 7.34,
      "fat": 0.19,
      "fiber": 2.6
    },
    "units": {
      "each": 15,
      "cup": 100
    }
  },
  {
    "id": "jalapeno",
    "name": "jalapeno",
    "aliases": [
      "jalapenos",
      "chili pepper",
      "chile"
    ],
    "per100g": {
      "kcal": 29,
      "protein": 0.91,
      "carb": 6.5,
      "fat": 0.37,
      "fiber": 2.8
    },
    "units": {
      "each": 14
    }
  },
  {
    "id": "white_rice",
    "name": "white rice",
    "aliases": [
      "rice",
      "jasmine rice",
      "basmati rice"
    ],
    "per100g": {
      "kcal": 130,
      "protein": 2.69,
      "carb": 28.2,
      "fat": 0.28,
      "fiber": 0.4
    },
    "note": "cooked",
    "units": {
      "cup": 158
    }
  },
  {
    "id": "brown_rice",
    "name": "brown rice",
    "aliases": [],
    "per100g": {
      "kcal": 123,
      "protein": 2.74,
      "carb": 25.6,
      "fat": 0.97,
      "fiber": 1.6
    },
    "note": "cooked",
    "units": {
      "cup": 195
    }
  },
  {
    "id": "quinoa",
    "name": "quinoa",
    "aliases": [],
    "per100g": {
      "kcal": 120,
      "protein": 4.4,
      "carb": 21.3,
      "fat": 1.92,
      "fiber": 2.8
    },
    "note": "cooked",
    "units": {
      "cup": 185
    }
  },
  {
    "id": "oats",
    "name": "oats",
    "aliases": [
      "oatmeal",
      "rolled oats",
      "old fashioned oats"
    ],
    "per100g": {
      "kcal": 389,
      "protein": 16.9,
      "carb": 66.3,
      "fat": 6.9,
      "fiber": 10.6
    },
    "note": "dry",
    "units": {
      "cup": 81,
      "half cup": 40
    }
  },
  {
    "id": "pasta",
    "name": "pasta",
    "aliases": [
      "spaghetti",
      "penne",
      "noodles",
      "macaroni"
    ],
    "per100g": {
      "kcal": 158,
      "protein": 5.8,
      "carb": 30.9,
      "fat": 0.93,
      "fiber": 1.8
    },
    "note": "cooked",
    "units": {
      "cup": 140
    }
  },
  {
    "id": "bread",
    "name": "bread",
    "aliases": [
      "white bread",
      "sandwich bread"
    ],
    "per100g": {
      "kcal": 265,
      "protein": 9,
      "carb": 49,
      "fat": 3.2,
      "fiber": 2.7
    },
    "units": {
      "slice": 28,
      "each": 28
    }
  },
  {
    "id": "whole_wheat_bread",
    "name": "whole wheat bread",
    "aliases": [
      "wheat bread",
      "whole grain bread"
    ],
    "per100g": {
      "kcal": 247,
      "protein": 13,
      "carb": 41,
      "fat": 3.4,
      "fiber": 7
    },
    "units": {
      "slice": 32,
      "each": 32
    }
  },
  {
    "id": "tortilla",
    "name": "tortilla",
    "aliases": [
      "flour tortilla",
      "wrap"
    ],
    "per100g": {
      "kcal": 306,
      "protein": 8.2,
      "carb": 51.4,
      "fat": 7.3,
      "fiber": 3.1
    },
    "units": {
      "each": 45,
      "large": 72
    }
  },
  {
    "id": "bagel",
    "name": "bagel",
    "aliases": [],
    "per100g": {
      "kcal": 250,
      "protein": 10,
      "carb": 49,
      "fat": 1.5,
      "fiber": 2.1
    },
    "units": {
      "each": 98
    }
  },
  {
    "id": "couscous",
    "name": "couscous",
    "aliases": [],
    "per100g": {
      "kcal": 112,
      "protein": 3.79,
      "carb": 23.2,
      "fat": 0.16,
      "fiber": 1.4
    },
    "note": "cooked",
    "units": {
      "cup": 157
    }
  },
  {
    "id": "farro",
    "name": "farro",
    "aliases": [
      "barley"
    ],
    "per100g": {
      "kcal": 123,
      "protein": 4.5,
      "carb": 26,
      "fat": 0.7,
      "fiber": 3.5
    },
    "note": "cooked",
    "units": {
      "cup": 170
    }
  },
  {
    "id": "tortilla_chips",
    "name": "tortilla chips",
    "aliases": [
      "corn chips"
    ],
    "per100g": {
      "kcal": 489,
      "protein": 6.6,
      "carb": 64.5,
      "fat": 23.4,
      "fiber": 5
    },
    "units": {
      "cup": 30,
      "oz": 28.35
    }
  },
  {
    "id": "granola",
    "name": "granola",
    "aliases": [],
    "per100g": {
      "kcal": 471,
      "protein": 10,
      "carb": 64,
      "fat": 20,
      "fiber": 7
    },
    "units": {
      "cup": 112,
      "tbsp": 7
    }
  },
  {
    "id": "black_beans",
    "name": "black beans",
    "aliases": [
      "black bean"
    ],
    "per100g": {
      "kcal": 132,
      "protein": 8.86,
      "carb": 23.7,
      "fat": 0.54,
      "fiber": 8.7
    },
    "note": "cooked",
    "units": {
      "cup": 172,
      "can": 240
    }
  },
  {
    "id": "chickpeas",
    "name": "chickpeas",
    "aliases": [
      "garbanzo beans",
      "garbanzos"
    ],
    "per100g": {
      "kcal": 164,
      "protein": 8.86,
      "carb": 27.4,
      "fat": 2.59,
      "fiber": 7.6
    },
    "note": "cooked",
    "units": {
      "cup": 164,
      "can": 240
    }
  },
  {
    "id": "lentils",
    "name": "lentils",
    "aliases": [
      "lentil"
    ],
    "per100g": {
      "kcal": 116,
      "protein": 9.02,
      "carb": 20.1,
      "fat": 0.38,
      "fiber": 7.9
    },
    "note": "cooked",
    "units": {
      "cup": 198
    }
  },
  {
    "id": "kidney_beans",
    "name": "kidney beans",
    "aliases": [
      "red beans"
    ],
    "per100g": {
      "kcal": 127,
      "protein": 8.67,
      "carb": 22.8,
      "fat": 0.5,
      "fiber": 6.4
    },
    "note": "cooked",
    "units": {
      "cup": 177,
      "can": 240
    }
  },
  {
    "id": "pinto_beans",
    "name": "pinto beans",
    "aliases": [],
    "per100g": {
      "kcal": 143,
      "protein": 9.01,
      "carb": 26.2,
      "fat": 0.65,
      "fiber": 9
    },
    "note": "cooked",
    "units": {
      "cup": 171,
      "can": 240
    }
  },
  {
    "id": "edamame",
    "name": "edamame",
    "aliases": [
      "soybeans"
    ],
    "per100g": {
      "kcal": 121,
      "protein": 11.9,
      "carb": 8.91,
      "fat": 5.2,
      "fiber": 5.2
    },
    "units": {
      "cup": 155
    }
  },
  {
    "id": "tofu",
    "name": "tofu",
    "aliases": [
      "firm tofu",
      "extra firm tofu"
    ],
    "per100g": {
      "kcal": 144,
      "protein": 17.3,
      "carb": 2.78,
      "fat": 8.72,
      "fiber": 2.3
    },
    "units": {
      "cup": 252,
      "block": 396,
      "oz": 28.35
    }
  },
  {
    "id": "tempeh",
    "name": "tempeh",
    "aliases": [],
    "per100g": {
      "kcal": 192,
      "protein": 20.3,
      "carb": 7.64,
      "fat": 10.8,
      "fiber": 0
    },
    "units": {
      "cup": 166,
      "oz": 28.35
    }
  },
  {
    "id": "almonds",
    "name": "almonds",
    "aliases": [
      "almond"
    ],
    "per100g": {
      "kcal": 579,
      "protein": 21.2,
      "carb": 21.6,
      "fat": 49.9,
      "fiber": 12.5
    },
    "units": {
      "cup": 143,
      "oz": 28.35,
      "each": 1.2,
      "tbsp": 9
    }
  },
  {
    "id": "walnuts",
    "name": "walnuts",
    "aliases": [
      "walnut"
    ],
    "per100g": {
      "kcal": 654,
      "protein": 15.2,
      "carb": 13.7,
      "fat": 65.2,
      "fiber": 6.7
    },
    "units": {
      "cup": 117,
      "oz": 28.35,
      "tbsp": 7
    }
  },
  {
    "id": "cashews",
    "name": "cashews",
    "aliases": [
      "cashew"
    ],
    "per100g": {
      "kcal": 553,
      "protein": 18.2,
      "carb": 30.2,
      "fat": 43.8,
      "fiber": 3.3
    },
    "units": {
      "cup": 137,
      "oz": 28.35,
      "tbsp": 9
    }
  },
  {
    "id": "peanuts",
    "name": "peanuts",
    "aliases": [
      "peanut"
    ],
    "per100g": {
      "kcal": 567,
      "protein": 25.8,
      "carb": 16.1,
      "fat": 49.2,
      "fiber": 8.5
    },
    "units": {
      "cup": 146,
      "oz": 28.35
    }
  },
  {
    "id": "pecans",
    "name": "pecans",
    "aliases": [
      "pecan"
    ],
    "per100g": {
      "kcal": 691,
      "protein": 9.17,
      "carb": 13.9,
      "fat": 72,
      "fiber": 9.6
    },
    "units": {
      "cup": 109,
      "oz": 28.35
    }
  },
  {
    "id": "peanut_butter",
    "name": "peanut butter",
    "aliases": [],
    "per100g": {
      "kcal": 588,
      "protein": 25.1,
      "carb": 19.6,
      "fat": 50.4,
      "fiber": 6
    },
    "g_per_ml": 1.08,
    "units": {
      "tbsp": 16,
      "cup": 258,
      "tsp": 5.3
    }
  },
  {
    "id": "almond_butter",
    "name": "almond butter",
    "aliases": [],
    "per100g": {
      "kcal": 614,
      "protein": 21,
      "carb": 18.8,
      "fat": 55.5,
      "fiber": 10.3
    },
    "g_per_ml": 1.08,
    "units": {
      "tbsp": 16,
      "cup": 256,
      "tsp": 5.3
    }
  },
  {
    "id": "chia_seeds",
    "name": "chia seeds",
    "aliases": [
      "chia",
      "chia seed"
    ],
    "per100g": {
      "kcal": 486,
      "protein": 16.5,
      "carb": 42.1,
      "fat": 30.7,
      "fiber": 34.4
    },
    "units": {
      "tbsp": 12,
      "tsp": 4,
      "cup": 192,
      "oz": 28.35
    }
  },
  {
    "id": "flax_seeds",
    "name": "flax seeds",
    "aliases": [
      "flaxseed",
      "ground flax",
      "linseed"
    ],
    "per100g": {
      "kcal": 534,
      "protein": 18.3,
      "carb": 28.9,
      "fat": 42.2,
      "fiber": 27.3
    },
    "units": {
      "tbsp": 10,
      "tsp": 3.4,
      "cup": 168
    }
  },
  {
    "id": "pumpkin_seeds",
    "name": "pumpkin seeds",
    "aliases": [
      "pepitas"
    ],
    "per100g": {
      "kcal": 559,
      "protein": 30.2,
      "carb": 10.7,
      "fat": 49.1,
      "fiber": 6
    },
    "units": {
      "cup": 129,
      "oz": 28.35,
      "tbsp": 8
    }
  },
  {
    "id": "sunflower_seeds",
    "name": "sunflower seeds",
    "aliases": [],
    "per100g": {
      "kcal": 584,
      "protein": 20.8,
      "carb": 20,
      "fat": 51.5,
      "fiber": 8.6
    },
    "units": {
      "cup": 140,
      "oz": 28.35,
      "tbsp": 9
    }
  },
  {
    "id": "sesame_seeds",
    "name": "sesame seeds",
    "aliases": [
      "sesame"
    ],
    "per100g": {
      "kcal": 573,
      "protein": 17.7,
      "carb": 23.4,
      "fat": 49.7,
      "fiber": 11.8
    },
    "units": {
      "tbsp": 9,
      "tsp": 3
    }
  },
  {
    "id": "milk_whole",
    "name": "whole milk",
    "aliases": [
      "milk"
    ],
    "per100g": {
      "kcal": 61,
      "protein": 3.15,
      "carb": 4.78,
      "fat": 3.25,
      "fiber": 0
    },
    "g_per_ml": 1.03,
    "units": {
      "cup": 244,
      "tbsp": 15
    }
  },
  {
    "id": "milk_skim",
    "name": "skim milk",
    "aliases": [
      "nonfat milk",
      "fat free milk",
      "2% milk"
    ],
    "per100g": {
      "kcal": 34,
      "protein": 3.37,
      "carb": 4.96,
      "fat": 0.08,
      "fiber": 0
    },
    "g_per_ml": 1.03,
    "units": {
      "cup": 245,
      "tbsp": 15
    }
  },
  {
    "id": "almond_milk",
    "name": "almond milk",
    "aliases": [
      "unsweetened almond milk"
    ],
    "per100g": {
      "kcal": 15,
      "protein": 0.59,
      "carb": 0.58,
      "fat": 1.1,
      "fiber": 0.3
    },
    "g_per_ml": 1.01,
    "units": {
      "cup": 240
    }
  },
  {
    "id": "oat_milk",
    "name": "oat milk",
    "aliases": [],
    "per100g": {
      "kcal": 48,
      "protein": 1.25,
      "carb": 6.67,
      "fat": 1.88,
      "fiber": 0.8
    },
    "g_per_ml": 1.03,
    "units": {
      "cup": 240
    }
  },
  {
    "id": "greek_yogurt",
    "name": "greek yogurt",
    "aliases": [
      "greek yoghurt",
      "plain greek yogurt",
      "nonfat greek yogurt"
    ],
    "per100g": {
      "kcal": 59,
      "protein": 10.3,
      "carb": 3.6,
      "fat": 0.39,
      "fiber": 0
    },
    "note": "plain, nonfat",
    "g_per_ml": 1.04,
    "units": {
      "cup": 245,
      "tbsp": 15,
      "container": 170
    }
  },
  {
    "id": "greek_yogurt_whole",
    "name": "whole milk greek yogurt",
    "aliases": [
      "full fat greek yogurt"
    ],
    "per100g": {
      "kcal": 97,
      "protein": 9,
      "carb": 3.98,
      "fat": 5,
      "fiber": 0
    },
    "g_per_ml": 1.04,
    "units": {
      "cup": 245,
      "container": 170
    }
  },
  {
    "id": "yogurt",
    "name": "yogurt",
    "aliases": [
      "plain yogurt",
      "yoghurt"
    ],
    "per100g": {
      "kcal": 61,
      "protein": 3.47,
      "carb": 4.66,
      "fat": 3.25,
      "fiber": 0
    },
    "g_per_ml": 1.04,
    "units": {
      "cup": 245,
      "container": 170
    }
  },
  {
    "id": "cottage_cheese",
    "name": "cottage cheese",
    "aliases": [],
    "per100g": {
      "kcal": 98,
      "protein": 11.1,
      "carb": 3.38,
      "fat": 4.3,
      "fiber": 0
    },
    "units": {
      "cup": 226,
      "tbsp": 14
    }
  },
  {
    "id": "cheddar",
    "name": "cheddar cheese",
    "aliases": [
      "cheddar",
      "cheese"
    ],
    "per100g": {
      "kcal": 403,
      "protein": 24.9,
      "carb": 1.28,
      "fat": 33.1,
      "fiber": 0
    },
    "units": {
      "oz": 28.35,
      "slice": 28,
      "cup": 113
    }
  },
  {
    "id": "mozzarella",
    "name": "mozzarella",
    "aliases": [
      "mozzarella cheese"
    ],
    "per100g": {
      "kcal": 300,
      "protein": 22.2,
      "carb": 2.19,
      "fat": 22.4,
      "fiber": 0
    },
    "units": {
      "oz": 28.35,
      "cup": 112,
      "slice": 28
    }
  },
  {
    "id": "parmesan",
    "name": "parmesan",
    "aliases": [
      "parmesan cheese",
      "parmigiano"
    ],
    "per100g": {
      "kcal": 431,
      "protein": 38.5,
      "carb": 4.06,
      "fat": 29,
      "fiber": 0
    },
    "units": {
      "oz": 28.35,
      "tbsp": 5,
      "cup": 100
    }
  },
  {
    "id": "feta",
    "name": "feta",
    "aliases": [
      "feta cheese"
    ],
    "per100g": {
      "kcal": 264,
      "protein": 14.2,
      "carb": 4.09,
      "fat": 21.3,
      "fiber": 0
    },
    "units": {
      "oz": 28.35,
      "cup": 150
    }
  },
  {
    "id": "cream_cheese",
    "name": "cream cheese",
    "aliases": [],
    "per100g": {
      "kcal": 342,
      "protein": 5.93,
      "carb": 5.52,
      "fat": 34.2,
      "fiber": 0
    },
    "units": {
      "tbsp": 14,
      "oz": 28.35
    }
  },
  {
    "id": "butter",
    "name": "butter",
    "aliases": [],
    "per100g": {
      "kcal": 717,
      "protein": 0.85,
      "carb": 0.06,
      "fat": 81.1,
      "fiber": 0
    },
    "units": {
      "tbsp": 14.2,
      "tsp": 4.7,
      "cup": 227,
      "stick": 113
    }
  },
  {
    "id": "egg",
    "name": "egg",
    "aliases": [
      "eggs",
      "whole egg",
      "large egg"
    ],
    "per100g": {
      "kcal": 143,
      "protein": 12.6,
      "carb": 0.72,
      "fat": 9.51,
      "fiber": 0
    },
    "units": {
      "each": 50,
      "large": 50,
      "medium": 44,
      "extra large": 56
    }
  },
  {
    "id": "egg_white",
    "name": "egg white",
    "aliases": [
      "egg whites"
    ],
    "per100g": {
      "kcal": 52,
      "protein": 10.9,
      "carb": 0.73,
      "fat": 0.17,
      "fiber": 0
    },
    "units": {
      "each": 33,
      "cup": 243
    }
  },
  {
    "id": "chicken_breast",
    "name": "chicken breast",
    "aliases": [
      "chicken",
      "boneless skinless chicken breast",
      "chicken breasts"
    ],
    "per100g": {
      "kcal": 120,
      "protein": 22.5,
      "carb": 0,
      "fat": 2.62,
      "fiber": 0
    },
    "note": "raw, boneless skinless",
    "units": {
      "each": 174,
      "breast": 174,
      "oz": 28.35,
      "cup": 140
    }
  },
  {
    "id": "chicken_thigh",
    "name": "chicken thigh",
    "aliases": [
      "chicken thighs"
    ],
    "per100g": {
      "kcal": 177,
      "protein": 19.7,
      "carb": 0,
      "fat": 10.4,
      "fiber": 0
    },
    "note": "raw, boneless skinless",
    "units": {
      "each": 95,
      "thigh": 95,
      "oz": 28.35
    }
  },
  {
    "id": "ground_beef_85",
    "name": "ground beef",
    "aliases": [
      "beef",
      "hamburger",
      "85/15 ground beef",
      "ground chuck"
    ],
    "per100g": {
      "kcal": 215,
      "protein": 18.6,
      "carb": 0,
      "fat": 15,
      "fiber": 0
    },
    "note": "raw, 85% lean",
    "units": {
      "oz": 28.35,
      "lb": 453.6,
      "patty": 113
    }
  },
  {
    "id": "ground_turkey",
    "name": "ground turkey",
    "aliases": [
      "turkey"
    ],
    "per100g": {
      "kcal": 148,
      "protein": 19.7,
      "carb": 0,
      "fat": 7.66,
      "fiber": 0
    },
    "note": "raw, 93% lean",
    "units": {
      "oz": 28.35,
      "lb": 453.6
    }
  },
  {
    "id": "steak",
    "name": "steak",
    "aliases": [
      "sirloin",
      "ribeye",
      "beef steak"
    ],
    "per100g": {
      "kcal": 201,
      "protein": 22.5,
      "carb": 0,
      "fat": 11.8,
      "fiber": 0
    },
    "note": "raw, sirloin",
    "units": {
      "oz": 28.35,
      "each": 226
    }
  },
  {
    "id": "pork_chop",
    "name": "pork chop",
    "aliases": [
      "pork",
      "pork loin"
    ],
    "per100g": {
      "kcal": 143,
      "protein": 21.4,
      "carb": 0,
      "fat": 5.66,
      "fiber": 0
    },
    "note": "raw, loin",
    "units": {
      "oz": 28.35,
      "each": 170
    }
  },
  {
    "id": "bacon",
    "name": "bacon",
    "aliases": [],
    "per100g": {
      "kcal": 541,
      "protein": 37,
      "carb": 1.43,
      "fat": 41.8,
      "fiber": 0
    },
    "note": "cooked",
    "units": {
      "slice": 8,
      "each": 8,
      "oz": 28.35
    }
  },
  {
    "id": "sausage",
    "name": "sausage",
    "aliases": [
      "italian sausage",
      "pork sausage"
    ],
    "per100g": {
      "kcal": 301,
      "protein": 16,
      "carb": 1.5,
      "fat": 25.8,
      "fiber": 0
    },
    "units": {
      "link": 68,
      "each": 68,
      "oz": 28.35
    }
  },
  {
    "id": "deli_turkey",
    "name": "deli turkey",
    "aliases": [
      "turkey breast",
      "sliced turkey"
    ],
    "per100g": {
      "kcal": 104,
      "protein": 17.1,
      "carb": 3.5,
      "fat": 2.3,
      "fiber": 0
    },
    "units": {
      "slice": 28,
      "oz": 28.35
    }
  },
  {
    "id": "salmon",
    "name": "salmon",
    "aliases": [
      "atlantic salmon"
    ],
    "per100g": {
      "kcal": 208,
      "protein": 20.4,
      "carb": 0,
      "fat": 13.4,
      "fiber": 0
    },
    "note": "raw",
    "units": {
      "oz": 28.35,
      "fillet": 170,
      "each": 170
    }
  },
  {
    "id": "tuna",
    "name": "tuna",
    "aliases": [
      "canned tuna",
      "ahi"
    ],
    "per100g": {
      "kcal": 116,
      "protein": 25.5,
      "carb": 0,
      "fat": 0.82,
      "fiber": 0
    },
    "units": {
      "oz": 28.35,
      "can": 142
    }
  },
  {
    "id": "shrimp",
    "name": "shrimp",
    "aliases": [
      "prawns"
    ],
    "per100g": {
      "kcal": 85,
      "protein": 20.1,
      "carb": 0.2,
      "fat": 0.51,
      "fiber": 0
    },
    "note": "raw",
    "units": {
      "oz": 28.35,
      "each": 7,
      "cup": 145
    }
  },
  {
    "id": "cod",
    "name": "cod",
    "aliases": [
      "white fish",
      "tilapia"
    ],
    "per100g": {
      "kcal": 82,
      "protein": 17.8,
      "carb": 0,
      "fat": 0.67,
      "fiber": 0
    },
    "note": "raw",
    "units": {
      "oz": 28.35,
      "fillet": 170
    }
  },
  {
    "id": "olive_oil",
    "name": "olive oil",
    "aliases": [
      "oil",
      "extra virgin olive oil",
      "evoo",
      "cooking oil"
    ],
    "per100g": {
      "kcal": 884,
      "protein": 0,
      "carb": 0,
      "fat": 100,
      "fiber": 0
    },
    "g_per_ml": 0.91,
    "units": {
      "tbsp": 13.5,
      "tsp": 4.5,
      "cup": 216
    }
  },
  {
    "id": "vegetable_oil",
    "name": "vegetable oil",
    "aliases": [
      "canola oil",
      "sunflower oil",
      "avocado oil",
      "grapeseed oil"
    ],
    "per100g": {
      "kcal": 884,
      "protein": 0,
      "carb": 0,
      "fat": 100,
      "fiber": 0
    },
    "g_per_ml": 0.92,
    "units": {
      "tbsp": 13.6,
      "tsp": 4.5,
      "cup": 218
    }
  },
  {
    "id": "sesame_oil",
    "name": "sesame oil",
    "aliases": [
      "toasted sesame oil"
    ],
    "per100g": {
      "kcal": 884,
      "protein": 0,
      "carb": 0,
      "fat": 100,
      "fiber": 0
    },
    "g_per_ml": 0.92,
    "units": {
      "tbsp": 13.6,
      "tsp": 4.5
    }
  },
  {
    "id": "coconut_oil",
    "name": "coconut oil",
    "aliases": [],
    "per100g": {
      "kcal": 892,
      "protein": 0,
      "carb": 0,
      "fat": 99.1,
      "fiber": 0
    },
    "g_per_ml": 0.92,
    "units": {
      "tbsp": 13.6,
      "tsp": 4.5
    }
  },
  {
    "id": "mayonnaise",
    "name": "mayonnaise",
    "aliases": [
      "mayo"
    ],
    "per100g": {
      "kcal": 680,
      "protein": 1,
      "carb": 0.6,
      "fat": 75,
      "fiber": 0
    },
    "g_per_ml": 0.91,
    "units": {
      "tbsp": 13.8,
      "tsp": 4.6
    }
  },
  {
    "id": "soy_sauce",
    "name": "soy sauce",
    "aliases": [
      "tamari",
      "shoyu"
    ],
    "per100g": {
      "kcal": 53,
      "protein": 8.14,
      "carb": 4.93,
      "fat": 0.57,
      "fiber": 0.8
    },
    "g_per_ml": 1.15,
    "units": {
      "tbsp": 16,
      "tsp": 5.3
    }
  },
  {
    "id": "kung_pao_sauce",
    "name": "kung pao sauce",
    "aliases": [
      "kung po sauce",
      "stir fry sauce",
      "teriyaki sauce"
    ],
    "per100g": {
      "kcal": 150,
      "protein": 2,
      "carb": 30,
      "fat": 2,
      "fiber": 0.5
    },
    "note": "bottled, sweet-savory stir fry sauce",
    "g_per_ml": 1.15,
    "units": {
      "tbsp": 17,
      "tsp": 5.7,
      "cup": 272
    }
  },
  {
    "id": "hot_sauce",
    "name": "hot sauce",
    "aliases": [
      "sriracha",
      "tabasco"
    ],
    "per100g": {
      "kcal": 93,
      "protein": 1.9,
      "carb": 19.2,
      "fat": 0.9,
      "fiber": 1.5
    },
    "g_per_ml": 1.1,
    "units": {
      "tbsp": 16,
      "tsp": 5.3
    }
  },
  {
    "id": "ketchup",
    "name": "ketchup",
    "aliases": [],
    "per100g": {
      "kcal": 101,
      "protein": 1.04,
      "carb": 25.8,
      "fat": 0.1,
      "fiber": 0.3
    },
    "g_per_ml": 1.14,
    "units": {
      "tbsp": 17,
      "tsp": 5.7
    }
  },
  {
    "id": "mustard",
    "name": "mustard",
    "aliases": [
      "dijon mustard"
    ],
    "per100g": {
      "kcal": 66,
      "protein": 4.37,
      "carb": 5.83,
      "fat": 3.34,
      "fiber": 3.3
    },
    "g_per_ml": 1.05,
    "units": {
      "tbsp": 15,
      "tsp": 5
    }
  },
  {
    "id": "salsa",
    "name": "salsa",
    "aliases": [
      "pico de gallo"
    ],
    "per100g": {
      "kcal": 36,
      "protein": 1.5,
      "carb": 7,
      "fat": 0.2,
      "fiber": 1.8
    },
    "g_per_ml": 1.03,
    "units": {
      "tbsp": 16,
      "cup": 245
    }
  },
  {
    "id": "hummus",
    "name": "hummus",
    "aliases": [],
    "per100g": {
      "kcal": 166,
      "protein": 7.9,
      "carb": 14.3,
      "fat": 9.6,
      "fiber": 6
    },
    "units": {
      "tbsp": 15,
      "cup": 246
    }
  },
  {
    "id": "tomato_sauce",
    "name": "tomato sauce",
    "aliases": [
      "marinara",
      "pasta sauce"
    ],
    "per100g": {
      "kcal": 57,
      "protein": 1.6,
      "carb": 8.6,
      "fat": 1.9,
      "fiber": 1.8
    },
    "g_per_ml": 1.04,
    "units": {
      "cup": 245,
      "tbsp": 15,
      "can": 425
    }
  },
  {
    "id": "salad_dressing",
    "name": "salad dressing",
    "aliases": [
      "ranch dressing",
      "vinaigrette",
      "italian dressing"
    ],
    "per100g": {
      "kcal": 350,
      "protein": 0.9,
      "carb": 8,
      "fat": 35,
      "fiber": 0
    },
    "g_per_ml": 0.95,
    "units": {
      "tbsp": 15,
      "tsp": 5
    }
  },
  {
    "id": "honey",
    "name": "honey",
    "aliases": [],
    "per100g": {
      "kcal": 304,
      "protein": 0.3,
      "carb": 82.4,
      "fat": 0,
      "fiber": 0.2
    },
    "g_per_ml": 1.42,
    "units": {
      "tbsp": 21,
      "tsp": 7,
      "cup": 339
    }
  },
  {
    "id": "maple_syrup",
    "name": "maple syrup",
    "aliases": [
      "syrup"
    ],
    "per100g": {
      "kcal": 260,
      "protein": 0.04,
      "carb": 67,
      "fat": 0.06,
      "fiber": 0
    },
    "g_per_ml": 1.32,
    "units": {
      "tbsp": 20,
      "tsp": 6.7,
      "cup": 312
    }
  },
  {
    "id": "sugar",
    "name": "sugar",
    "aliases": [
      "white sugar",
      "granulated sugar"
    ],
    "per100g": {
      "kcal": 387,
      "protein": 0,
      "carb": 100,
      "fat": 0,
      "fiber": 0
    },
    "units": {
      "tsp": 4.2,
      "tbsp": 12.5,
      "cup": 200
    }
  },
  {
    "id": "brown_sugar",
    "name": "brown sugar",
    "aliases": [],
    "per100g": {
      "kcal": 380,
      "protein": 0.12,
      "carb": 98.1,
      "fat": 0,
      "fiber": 0
    },
    "units": {
      "tsp": 4.6,
      "tbsp": 13.8,
      "cup": 220
    }
  },
  {
    "id": "cocoa_powder",
    "name": "cocoa powder",
    "aliases": [
      "cacao powder"
    ],
    "per100g": {
      "kcal": 228,
      "protein": 19.6,
      "carb": 57.9,
      "fat": 13.7,
      "fiber": 33.2
    },
    "units": {
      "tbsp": 5,
      "tsp": 1.7,
      "cup": 86
    }
  },
  {
    "id": "protein_powder",
    "name": "protein powder",
    "aliases": [
      "whey protein",
      "whey"
    ],
    "per100g": {
      "kcal": 375,
      "protein": 75,
      "carb": 10,
      "fat": 4,
      "fiber": 2
    },
    "units": {
      "scoop": 32,
      "each": 32,
      "cup": 120
    }
  },
  {
    "id": "coffee",
    "name": "coffee",
    "aliases": [
      "black coffee",
      "espresso"
    ],
    "per100g": {
      "kcal": 1,
      "protein": 0.12,
      "carb": 0,
      "fat": 0.02,
      "fiber": 0
    },
    "g_per_ml": 1,
    "units": {
      "cup": 237,
      "shot": 30
    }
  },
  {
    "id": "beer",
    "name": "beer",
    "aliases": [],
    "per100g": {
      "kcal": 43,
      "protein": 0.46,
      "carb": 3.55,
      "fat": 0,
      "fiber": 0
    },
    "g_per_ml": 1.01,
    "units": {
      "each": 356,
      "can": 356,
      "bottle": 356,
      "pint": 473
    }
  },
  {
    "id": "wine",
    "name": "wine",
    "aliases": [
      "red wine",
      "white wine"
    ],
    "per100g": {
      "kcal": 83,
      "protein": 0.07,
      "carb": 2.61,
      "fat": 0,
      "fiber": 0
    },
    "g_per_ml": 0.99,
    "units": {
      "glass": 147,
      "each": 147,
      "bottle": 750
    }
  },
  {
    "id": "orange_juice",
    "name": "orange juice",
    "aliases": [
      "oj"
    ],
    "per100g": {
      "kcal": 45,
      "protein": 0.7,
      "carb": 10.4,
      "fat": 0.2,
      "fiber": 0.2
    },
    "g_per_ml": 1.04,
    "units": {
      "cup": 248
    }
  },
  {
    "id": "soda",
    "name": "soda",
    "aliases": [
      "cola",
      "pop",
      "soft drink"
    ],
    "per100g": {
      "kcal": 41,
      "protein": 0,
      "carb": 10.6,
      "fat": 0,
      "fiber": 0
    },
    "g_per_ml": 1.04,
    "units": {
      "can": 355,
      "each": 355,
      "bottle": 591
    }
  },
  {
    "id": "dark_chocolate",
    "name": "dark chocolate",
    "aliases": [
      "chocolate"
    ],
    "per100g": {
      "kcal": 546,
      "protein": 4.88,
      "carb": 61.2,
      "fat": 31.3,
      "fiber": 7
    },
    "units": {
      "oz": 28.35,
      "square": 10,
      "bar": 43
    }
  },
  {
    "id": "ice_cream",
    "name": "ice cream",
    "aliases": [],
    "per100g": {
      "kcal": 207,
      "protein": 3.5,
      "carb": 23.6,
      "fat": 11,
      "fiber": 0.7
    },
    "units": {
      "cup": 132,
      "scoop": 66
    }
  },
  {
    "id": "pizza",
    "name": "pizza",
    "aliases": [
      "cheese pizza"
    ],
    "per100g": {
      "kcal": 266,
      "protein": 11,
      "carb": 33,
      "fat": 10,
      "fiber": 2.3
    },
    "units": {
      "slice": 107,
      "each": 107
    }
  },
  {
    "id": "protein_bar",
    "name": "protein bar",
    "aliases": [
      "energy bar",
      "granola bar"
    ],
    "per100g": {
      "kcal": 400,
      "protein": 25,
      "carb": 42,
      "fat": 13,
      "fiber": 8
    },
    "units": {
      "each": 60,
      "bar": 60
    }
  }
];
