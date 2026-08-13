<?php

return [
    'auth_driver' => env('AUTH_DRIVER', 'firebase'),
    'firebase_project_id' => env('FIREBASE_PROJECT_ID', 'altura-grafica-ia'),
    'firebase_emulator_host' => env('FIREBASE_AUTH_EMULATOR_HOST'),
    'fal_key' => env('FAL_KEY', ''),
    'fal_proxy_url' => env('FAL_PROXY_URL', ''),
    'fal_proxy_hmac_secret' => env('FAL_PROXY_HMAC_SECRET', ''),
    'asset_ttl_days' => (int) env('ASSET_TTL_DAYS', 7),
    'asset_viewer_token_ttl' => (int) env('ASSET_VIEWER_TOKEN_TTL', 14400),
    'asset_thumbnail_token_ttl' => (int) env('ASSET_THUMBNAIL_TOKEN_TTL', 900),
    'initial_credits' => (int) env('INITIAL_CREDITS', 20),
    'max_upload_kb' => (int) env('MAX_UPLOAD_KB', 51200),
    'max_input_side' => (int) env('MAX_INPUT_SIDE', 20000),
    'max_input_pixels' => (int) env('MAX_INPUT_PIXELS', 100000000),
    'max_output_side' => (int) env('MAX_OUTPUT_SIDE', 32768),
    'max_output_pixels' => (int) env('MAX_OUTPUT_PIXELS', 400000000),
    'image_jobs_soft_limit' => (int) env('IMAGE_JOBS_SOFT_LIMIT', 80),
    'image_jobs_hard_limit' => (int) env('IMAGE_JOBS_HARD_LIMIT', 100),
    'job_stale_minutes' => (int) env('JOB_STALE_MINUTES', 720),
    'secret_status' => [
        'fal' => [
            'configured' => (string) env('FAL_KEY', '') !== '' || (
                str_starts_with((string) env('FAL_PROXY_URL', ''), 'https://')
                && strlen((string) env('FAL_PROXY_HMAC_SECRET', '')) >= 32
            ),
            'rotated_at' => env('FAL_PROXY_ROTATED_AT', env('FAL_KEY_ROTATED_AT')),
        ],
    ],
];
