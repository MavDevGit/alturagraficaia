<?php

return [
    'auth_driver' => env('AUTH_DRIVER', 'firebase'),
    'firebase_project_id' => env('FIREBASE_PROJECT_ID', 'altura-grafica-ia'),
    'firebase_credentials' => env('FIREBASE_CREDENTIALS'),
    'firebase_emulator_host' => env('FIREBASE_AUTH_EMULATOR_HOST'),
    'image_service_url' => env('IMAGE_SERVICE_URL', 'http://127.0.0.1:8787'),
    'image_service_audience' => env('IMAGE_SERVICE_AUDIENCE'),
    'image_service_key' => env('IMAGE_SERVICE_KEY', 'change-me-locally'),
    'callback_secret' => env('IMAGE_CALLBACK_SECRET', 'change-me-locally'),
    'asset_ttl_days' => (int) env('ASSET_TTL_DAYS', 7),
    'asset_viewer_token_ttl' => (int) env('ASSET_VIEWER_TOKEN_TTL', 14400),
    'initial_credits' => (int) env('INITIAL_CREDITS', 20),
    'max_upload_kb' => (int) env('MAX_UPLOAD_KB', 51200),
    'max_input_side' => (int) env('MAX_INPUT_SIDE', 20000),
    'max_input_pixels' => (int) env('MAX_INPUT_PIXELS', 100000000),
    'max_output_side' => (int) env('MAX_OUTPUT_SIDE', 32768),
    'max_output_pixels' => (int) env('MAX_OUTPUT_PIXELS', 400000000),
    'storage_soft_limit_bytes' => (int) env('STORAGE_SOFT_LIMIT_BYTES', 3758096384),
    'storage_hard_limit_bytes' => (int) env('STORAGE_HARD_LIMIT_BYTES', 4294967296),
    'image_jobs_soft_limit' => (int) env('IMAGE_JOBS_SOFT_LIMIT', 80),
    'image_jobs_hard_limit' => (int) env('IMAGE_JOBS_HARD_LIMIT', 100),
    'gcs_class_a_soft_limit' => (int) env('GCS_CLASS_A_SOFT_LIMIT', 4200),
    'gcs_class_a_hard_limit' => (int) env('GCS_CLASS_A_HARD_LIMIT', 4700),
    'job_stale_minutes' => (int) env('JOB_STALE_MINUTES', 720),
    'secret_status' => [
        'fal' => [
            'configured' => (bool) env('FAL_KEY_CONFIGURED', false),
            'rotated_at' => env('FAL_KEY_ROTATED_AT'),
        ],
    ],
];
