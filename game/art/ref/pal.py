"""Палитры эталона. CH1 — тёплый вечер (золотой час), CH2 — дом вечером, CH3 — дорога перед рассветом
(ключи те же, что у CH1: уличные функции красят обе главы), DAWN — терапия."""
CH1 = {
    # небо сверху вниз
    'sky0': '#3b2f6b', 'sky1': '#5b3d7e', 'sky2': '#8a4b88', 'sky3': '#bb5889',
    'sky4': '#e26b7f', 'sky5': '#f78a6f', 'sky6': '#ffab70', 'sky7': '#ffc883', 'sky8': '#ffe0a3',
    'sun': '#fff7d6', 'sun_halo': '#ffeab0',
    # облака: подсветка снизу, верх в розово-лиловом
    'cl_top': '#c4688d', 'cl_mid': '#ee8c8e', 'cl_lit': '#ffc79a', 'cl_hot': '#ffe7b8',
    # дальний город: светлее и холоднее, тонет в дымке
    'far': '#e3958f', 'far_rim': '#ffc390', 'far_dk': '#d5868d',
    # средний план: розово-сливовые фасады против солнца, тёплые окна
    'mid': '#a35a78', 'mid_dk': '#8a4a6c', 'mid_rim': '#ffb07c', 'mid_hi': '#c26e82',
    'win': '#ffd27a', 'win_hi': '#fff2b8', 'win_off': '#7c4266',
    'haze': '#efa184',
    # ближний план: теплее и темнее
    'near': '#5c2c45', 'near_dk': '#43203a', 'near_rim': '#f39462', 'leaf': '#6e3448', 'leaf_lit': '#b8545a',
    # земля
    'curb_hi': '#ffd39a', 'curb': '#f0a477', 'pave': '#c8735f', 'pave_sh': '#a85a58',
    'wall': '#7a3a4c', 'wall_dk': '#62293f', 'wall_hi': '#8f4a58', 'soil': '#3e1a30',
    # контуры
    'ink': '#2a1424', 'ink_cool': '#1c1838',
}
CH2 = {  # дом вечером: торшер, тёплое дерево, обои пыльной розы, за окном сумерки
    'wall': '#c98a7e', 'wall_dk': '#a8676a', 'wall_pat': '#dba08c', 'trim': '#f2d2a8',
    'wood_dk': '#6b3a32', 'wood': '#9a5a3e', 'wood_hi': '#c98552', 'rug': '#b44e5a', 'rug_hi': '#e07a6e',
    'lamp': '#ffe2a0', 'lamp_glow': '#ffc878', 'shade': '#f3a35c', 'plant': '#5e8a5a', 'plant_hi': '#8fbf6a',
    'window': '#6a5a9e', 'window_hi': '#e88aa0', 'sofa': '#4f6e8a', 'sofa_hi': '#7aa0b4', 'ink': '#2e1a1e',
}
DAWN = {  # терапия: рассвет и утро — свежо, светло, мята и лазурь при тёплом солнце
    'sky0': '#7aa7d8', 'sky1': '#a6c8e8', 'sky2': '#d7e4ee', 'sky3': '#ffe2c4', 'sky4': '#ffc6a8',
    'sun': '#fff8e0', 'mint': '#8fd8b8', 'mint_dk': '#5aa890', 'leaf': '#6fbf6a', 'leaf_hi': '#b8e88a',
    'stone': '#e8d6c0', 'stone_dk': '#b8a090', 'roof': '#e98a6a', 'lilac': '#b7a2e0', 'ink': '#2c3a52',
}
CH3 = {  # дорога: синий час, у горизонта впереди розовеет; холоднее гл.1, но чище и светлее к земле
    'sky0': '#2f3a78', 'sky1': '#44509a', 'sky2': '#6468b4', 'sky3': '#8a7cc4',
    'sky4': '#b48cc8', 'sky5': '#dc9cc0', 'sky6': '#f6b0b0', 'sky7': '#ffc9a6', 'sky8': '#ffe4bc',
    'sun': '#fff6e0', 'sun_halo': '#ffeccc',
    'cl_top': '#7676ba', 'cl_mid': '#a48cc8', 'cl_lit': '#f2b0c0', 'cl_hot': '#ffdcc0',
    'far': '#9a92cc', 'far_rim': '#ecbcd0', 'far_dk': '#8680c0',
    'mid': '#6c6aa8', 'mid_dk': '#575690', 'mid_rim': '#f4b4b8', 'mid_hi': '#8a86c0',
    'win': '#ffd890', 'win_hi': '#fff4c8', 'win_off': '#4c4a84',
    'haze': '#eab6c6',
    'near': '#343a6c', 'near_dk': '#262a56', 'near_rim': '#f0a4a4', 'leaf': '#3a5e72', 'leaf_lit': '#78b89c',
    'curb_hi': '#ffeed0', 'curb': '#ecc8b4', 'pave': '#b898a6', 'pave_sh': '#8c7698',
    'wall': '#5c528c', 'wall_dk': '#463e74', 'wall_hi': '#746aa2', 'soil': '#2c2652',
    'ink': '#1e1a3c', 'ink_cool': '#1c1838',
}
