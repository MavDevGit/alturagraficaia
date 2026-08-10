<?php

use Illuminate\Support\Facades\Storage;

it('registers temporary URL support for the Flysystem GCS adapter', function (): void {
    config()->set([
        'filesystems.disks.gcs.project_id' => 'test-project',
        'filesystems.disks.gcs.bucket' => 'test-private-bucket',
        'filesystems.disks.gcs.key_file' => null,
    ]);
    Storage::forgetDisk('gcs');

    expect(Storage::disk('gcs')->providesTemporaryUrls())->toBeTrue();
});
