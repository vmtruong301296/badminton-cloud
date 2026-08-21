<?php

return [
    // Giá xăng điều chỉnh mỗi thứ Năm nên cache 6 giờ là quá đủ tươi.
    'cache_ttl_minutes' => 360,

    // Quá 10 ngày là chắc chắn đã lỡ ít nhất một kỳ điều chỉnh.
    'stale_after_days' => 10,

    // Chặn parser bắt nhầm số khác trên trang.
    'min_price' => 10000,
    'max_price' => 60000,

    'source_timeout_seconds' => 5,

    'types' => [
        'e10_ron95_iii' => [
            'label' => 'Xăng E10 RON 95-III',
            'pattern' => 'E10 RON 95-III',
            'fallback_price' => 22660,
        ],
    ],
];
