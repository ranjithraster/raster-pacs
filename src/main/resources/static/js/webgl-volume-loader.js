/**
 * WebGL Volume Loader
 * Fetches raw DICOM pixel data and converts to HU values for 3D rendering.
 * Supports progressive loading with subsampling.
 */

class VolumeDataLoader {
    constructor() {
        this.metadata = null;
        this.volumeData = null;
        this.isLoading = false;
        this.loadProgress = 0;
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }

    /**
     * Load volume data with progressive enhancement
     * @param {string} studyUid - Study Instance UID
     * @param {string} seriesUid - Series Instance UID
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Volume data with metadata
     */
    async loadVolume(studyUid, seriesUid, options = {}) {
        const {
            progressive = true,
            onProgress = null,
            onEnhancing = null
        } = options;

        this.isLoading = true;
        this.onProgress = onProgress;

        try {
            if (progressive) {
                // Progressive loading: low-res first, then enhance
                return await this.loadProgressively(studyUid, seriesUid, onEnhancing);
            } else {
                // Single full-resolution load
                return await this.loadSinglePass(studyUid, seriesUid, 1);
            }
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load progressively: subsample=4 → 2 → 1
     * Returns the first pass immediately, then enhances in background
     */
    async loadProgressively(studyUid, seriesUid, onEnhancing) {
        const passes = [4, 2, 1]; // Subsample factors

        // Load first pass immediately
        console.log('Loading initial low-res volume (subsample=4)...');
        let result = await this.loadSinglePass(studyUid, seriesUid, passes[0]);

        // Notify progress
        if (this.onProgress) {
            this.onProgress({
                phase: 'initial',
                subsample: passes[0],
                sliceCount: result.metadata.sliceCount,
                originalSliceCount: result.metadata.originalSliceCount
            });
        }

        // Schedule background enhancement (don't await - let it run in background)
        this.enhanceInBackground(studyUid, seriesUid, passes.slice(1), onEnhancing);

        return result;
    }

    /**
     * Enhance volume quality in background with remaining passes
     */
    async enhanceInBackground(studyUid, seriesUid, remainingPasses, onEnhancing) {
        for (let i = 0; i < remainingPasses.length; i++) {
            const subsample = remainingPasses[i];
            const isFinalPass = i === remainingPasses.length - 1;

            // Small delay between passes to not overwhelm the server
            await new Promise(resolve => setTimeout(resolve, 500));

            if (onEnhancing) {
                onEnhancing(subsample, remainingPasses.length - i);
            }

            try {
                console.log(`Enhancing volume (subsample=${subsample})...`);
                const result = await this.loadSinglePass(studyUid, seriesUid, subsample);

                // Store the enhanced data
                this.metadata = result.metadata;
                this.volumeData = result.huVolume;

                // Notify progress
                if (this.onProgress) {
                    this.onProgress({
                        phase: isFinalPass ? 'complete' : 'enhancing',
                        subsample,
                        sliceCount: result.metadata.sliceCount,
                        originalSliceCount: result.metadata.originalSliceCount,
                        data: result // Include data for renderer update
                    });
                }

                console.log(`Enhancement pass ${subsample} complete`);
            } catch (error) {
                console.error(`Failed to enhance with subsample ${subsample}:`, error);
                // Continue with next pass or stop if this was the last one
            }
        }

        console.log('Volume enhancement complete');
    }

    /**
     * Load volume data in a single pass with specified subsampling
     */
    async loadSinglePass(studyUid, seriesUid, subsample) {
        console.log(`Loading volume data: subsample=${subsample}`);

        const response = await api.getVolumePixelData(studyUid, seriesUid, subsample);

        if (response.status === 202) {
            throw new Error('Volume data not yet cached. Retrieval in progress.');
        }

        if (!response.ok) {
            throw new Error(`Failed to load volume: ${response.status} ${response.statusText}`);
        }

        // Parse multipart response
        const { metadata, pixelData } = await this.parseMultipartResponse(response);

        // Convert to HU values
        const huVolume = this.convertToHU(pixelData, metadata);

        this.metadata = metadata;
        this.volumeData = huVolume;

        return {
            metadata,
            huVolume,
            dimensions: {
                width: metadata.columns,
                height: metadata.rows,
                depth: metadata.sliceCount
            },
            spacing: {
                x: metadata.pixelSpacing?.[1] || 1,
                y: metadata.pixelSpacing?.[0] || 1,
                z: metadata.spacingBetweenSlices || metadata.sliceThickness || 1
            }
        };
    }

    /**
     * Parse multipart response containing JSON metadata and binary pixel data
     */
    async parseMultipartResponse(response) {
        const contentType = response.headers.get('content-type');
        console.log('[VolumeLoader] Content-Type:', contentType);

        const boundaryMatch = contentType.match(/boundary=(.+)/);

        if (!boundaryMatch) {
            throw new Error('Invalid multipart response: no boundary found');
        }

        const boundary = boundaryMatch[1];
        console.log('[VolumeLoader] Boundary:', boundary);

        const arrayBuffer = await response.arrayBuffer();
        console.log('[VolumeLoader] Response arrayBuffer size:', arrayBuffer.byteLength, 'bytes');

        const uint8Array = new Uint8Array(arrayBuffer);

        // Find parts by boundary
        const boundaryBytes = new TextEncoder().encode('--' + boundary);
        const parts = this.splitByBoundary(uint8Array, boundaryBytes);

        console.log('[VolumeLoader] Found', parts.length, 'parts in multipart response');
        parts.forEach((part, idx) => {
            console.log(`[VolumeLoader] Part ${idx} size:`, part.length, 'bytes');
        });

        if (parts.length < 2) {
            throw new Error('Invalid multipart response: expected 2 parts');
        }

        // Parse first part as JSON metadata
        const metadataPart = parts[0];
        const metadataText = this.extractPartBody(metadataPart);
        console.log('[VolumeLoader] Metadata text (first 500 chars):', metadataText.substring(0, 500));
        const metadata = JSON.parse(metadataText);

        // Parse second part as binary pixel data
        const pixelDataPart = parts[1];
        const pixelData = this.extractBinaryBody(pixelDataPart);

        console.log('[VolumeLoader] Parsed volume metadata:', JSON.stringify(metadata, null, 2));
        console.log('[VolumeLoader] Pixel data ArrayBuffer size:', pixelData.byteLength, 'bytes');
        console.log('[VolumeLoader] Expected size for 16-bit data:', metadata.columns * metadata.rows * metadata.sliceCount * 2, 'bytes');

        return { metadata, pixelData };
    }

    /**
     * Split multipart data by boundary
     */
    splitByBoundary(data, boundaryBytes) {
        const parts = [];
        let start = 0;

        while (start < data.length) {
            // Find next boundary
            const boundaryIndex = this.findSequence(data, boundaryBytes, start);
            if (boundaryIndex === -1) break;

            // Skip boundary and CRLF
            let partStart = boundaryIndex + boundaryBytes.length;
            if (data[partStart] === 0x0D && data[partStart + 1] === 0x0A) {
                partStart += 2;
            }

            // Find end of this part (next boundary)
            const nextBoundary = this.findSequence(data, boundaryBytes, partStart);
            const partEnd = nextBoundary !== -1 ? nextBoundary - 2 : data.length; // -2 for CRLF before boundary

            if (partEnd > partStart) {
                parts.push(data.slice(partStart, partEnd));
            }

            start = nextBoundary !== -1 ? nextBoundary : data.length;
        }

        return parts;
    }

    /**
     * Find a byte sequence in an array
     */
    findSequence(data, sequence, start = 0) {
        outer: for (let i = start; i <= data.length - sequence.length; i++) {
            for (let j = 0; j < sequence.length; j++) {
                if (data[i + j] !== sequence[j]) continue outer;
            }
            return i;
        }
        return -1;
    }

    /**
     * Extract text body from a multipart part (skips headers)
     */
    extractPartBody(part) {
        // Find double CRLF that separates headers from body
        const headerEnd = this.findSequence(part, new Uint8Array([0x0D, 0x0A, 0x0D, 0x0A]));
        const bodyStart = headerEnd !== -1 ? headerEnd + 4 : 0;
        const body = part.slice(bodyStart);
        return new TextDecoder().decode(body);
    }

    /**
     * Extract binary body from a multipart part (skips headers)
     */
    extractBinaryBody(part) {
        // Find double CRLF that separates headers from body
        const headerEnd = this.findSequence(part, new Uint8Array([0x0D, 0x0A, 0x0D, 0x0A]));
        const bodyStart = headerEnd !== -1 ? headerEnd + 4 : 0;

        console.log(`[VolumeLoader] extractBinaryBody: part.length=${part.length}, headerEnd=${headerEnd}, bodyStart=${bodyStart}`);

        // Use slice() to create a copy of just the body portion
        // Note: Uint8Array.slice() returns a new array with its own buffer
        const bodyArray = part.slice(bodyStart);

        console.log(`[VolumeLoader] bodyArray: length=${bodyArray.length}, byteOffset=${bodyArray.byteOffset}, buffer.byteLength=${bodyArray.buffer.byteLength}`);

        // Check first few bytes to verify we got proper binary data
        if (bodyArray.length >= 10) {
            const firstBytes = Array.from(bodyArray.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`[VolumeLoader] First 10 bytes: ${firstBytes}`);
        }

        // Return a proper ArrayBuffer copy (not a view into the original buffer)
        const result = bodyArray.buffer.slice(bodyArray.byteOffset, bodyArray.byteOffset + bodyArray.byteLength);
        console.log(`[VolumeLoader] Returning ArrayBuffer with byteLength=${result.byteLength}`);
        return result;
    }

    /**
     * Convert raw pixel data to Hounsfield Units
     * HU = pixel * rescaleSlope + rescaleIntercept
     */
    convertToHU(pixelData, metadata) {
        const slope = metadata.rescaleSlope || 1;
        const intercept = metadata.rescaleIntercept || 0;
        const isSigned = metadata.pixelRepresentation === 1;

        console.log(`[VolumeLoader] Converting to HU: slope=${slope}, intercept=${intercept}, signed=${isSigned}`);
        console.log(`[VolumeLoader] pixelData type: ${pixelData?.constructor?.name}, byteLength=${pixelData?.byteLength}`);

        if (!pixelData || pixelData.byteLength === 0) {
            console.error('[VolumeLoader] ERROR: pixelData is empty or null!');
            throw new Error('Pixel data is empty');
        }

        // Create view based on data format
        const pixelCount = pixelData.byteLength / 2; // 16-bit pixels
        console.log(`[VolumeLoader] Expected pixel count: ${pixelCount}`);

        let inputView;
        try {
            inputView = isSigned
                ? new Int16Array(pixelData)
                : new Uint16Array(pixelData);
            console.log(`[VolumeLoader] Created ${isSigned ? 'Int16' : 'Uint16'}Array with length: ${inputView.length}`);
        } catch (e) {
            console.error('[VolumeLoader] ERROR creating typed array:', e);
            throw e;
        }

        // Debug: Check raw pixel values at various positions
        const sampleIndices = [0, 1, 10, 100, 1000, Math.floor(inputView.length / 4), Math.floor(inputView.length / 2), inputView.length - 1];
        console.log('[VolumeLoader] Sample raw pixel values:');
        sampleIndices.forEach(i => {
            if (i < inputView.length) {
                console.log(`  [${i}]: raw=${inputView[i]}, HU=${inputView[i] * slope + intercept}`);
            }
        });

        // Count zeros and check for valid data
        let zeroCount = 0;
        let rawMin = Infinity, rawMax = -Infinity;
        for (let i = 0; i < Math.min(inputView.length, 100000); i++) {
            if (inputView[i] === 0) zeroCount++;
            rawMin = Math.min(rawMin, inputView[i]);
            rawMax = Math.max(rawMax, inputView[i]);
        }
        console.log(`[VolumeLoader] Raw pixel range (first 100k): ${rawMin} to ${rawMax}`);
        console.log(`[VolumeLoader] Zeros in first 100k: ${zeroCount}`);

        // Output as Float32 for HU values (can be negative)
        const huData = new Float32Array(pixelCount);

        for (let i = 0; i < pixelCount; i++) {
            huData[i] = inputView[i] * slope + intercept;
        }

        // Check HU statistics
        let huMin = Infinity, huMax = -Infinity, huSum = 0;
        for (let i = 0; i < Math.min(huData.length, 10000); i++) {
            huMin = Math.min(huMin, huData[i]);
            huMax = Math.max(huMax, huData[i]);
            huSum += huData[i];
        }
        console.log(`[VolumeLoader] HU range (first 10k): ${huMin.toFixed(0)} to ${huMax.toFixed(0)}, avg=${(huSum/10000).toFixed(0)}`);

        return huData;
    }

    /**
     * Get volume statistics
     */
    getVolumeStats() {
        if (!this.volumeData) return null;

        let min = Infinity, max = -Infinity, sum = 0;
        const data = this.volumeData;

        for (let i = 0; i < data.length; i++) {
            const val = data[i];
            if (val < min) min = val;
            if (val > max) max = val;
            sum += val;
        }

        return {
            min,
            max,
            mean: sum / data.length,
            voxelCount: data.length
        };
    }

    /**
     * Normalize volume data to 0-1 range for texture upload
     * Uses a specified HU window
     */
    normalizeForTexture(huMin = -1024, huMax = 3071) {
        if (!this.volumeData) return null;

        const range = huMax - huMin;
        const normalized = new Float32Array(this.volumeData.length);

        for (let i = 0; i < this.volumeData.length; i++) {
            const hu = this.volumeData[i];
            normalized[i] = Math.max(0, Math.min(1, (hu - huMin) / range));
        }

        return normalized;
    }

    /**
     * Downsample volume to fit within GPU texture limits
     */
    downsampleVolume(maxSize = 256) {
        if (!this.volumeData || !this.metadata) return null;

        const { columns, rows, sliceCount } = this.metadata;

        // Calculate downsample factors
        const factorX = Math.ceil(columns / maxSize);
        const factorY = Math.ceil(rows / maxSize);
        const factorZ = Math.ceil(sliceCount / maxSize);

        if (factorX === 1 && factorY === 1 && factorZ === 1) {
            return { data: this.volumeData, dimensions: { width: columns, height: rows, depth: sliceCount } };
        }

        const newWidth = Math.ceil(columns / factorX);
        const newHeight = Math.ceil(rows / factorY);
        const newDepth = Math.ceil(sliceCount / factorZ);

        console.log(`Downsampling volume from ${columns}x${rows}x${sliceCount} to ${newWidth}x${newHeight}x${newDepth}`);

        const downsampled = new Float32Array(newWidth * newHeight * newDepth);

        for (let z = 0; z < newDepth; z++) {
            for (let y = 0; y < newHeight; y++) {
                for (let x = 0; x < newWidth; x++) {
                    // Sample from original volume (nearest neighbor for speed)
                    const srcX = Math.min(x * factorX, columns - 1);
                    const srcY = Math.min(y * factorY, rows - 1);
                    const srcZ = Math.min(z * factorZ, sliceCount - 1);
                    const srcIndex = srcZ * (columns * rows) + srcY * columns + srcX;
                    const dstIndex = z * (newWidth * newHeight) + y * newWidth + x;
                    downsampled[dstIndex] = this.volumeData[srcIndex];
                }
            }
        }

        return {
            data: downsampled,
            dimensions: { width: newWidth, height: newHeight, depth: newDepth }
        };
    }
}

// Export for use in other modules
window.VolumeDataLoader = VolumeDataLoader;

