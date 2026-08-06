// A dependency-free crop/zoom tool for avatar photos. Shows the picked image
// in a circular viewport the user can drag and zoom, then bakes the visible
// region into a square JPEG blob on save.

const VIEWPORT = 260;
const OUTPUT_SIZE = 480;

export function openAvatarCropper(file) {
	return new Promise((resolve) => {
		const objectUrl = URL.createObjectURL(file);
		const overlay = document.createElement('div');
		overlay.className = 'modal-overlay';
		overlay.innerHTML = `
			<div class="modal-box" style="max-width:340px;">
				<h3 style="margin-top:0;">Adjust your photo</h3>
				<p class="sub">Drag to reposition, use the slider to zoom.</p>
				<div class="crop-viewport" id="crop-viewport">
					<img id="crop-image" src="${objectUrl}" draggable="false" alt="" />
				</div>
				<input type="range" id="crop-zoom" min="1" max="3" step="0.01" value="1" style="width:100%;margin:16px 0 4px;" />
				<div class="modal-actions">
					<button class="btn btn-outline btn-block" id="crop-cancel">Cancel</button>
					<button class="btn btn-primary btn-block" id="crop-save">Save</button>
				</div>
			</div>
		`;
		document.body.appendChild(overlay);

		const img = overlay.querySelector('#crop-image');
		const viewport = overlay.querySelector('#crop-viewport');
		const zoomInput = overlay.querySelector('#crop-zoom');

		let naturalWidth = 0;
		let naturalHeight = 0;
		let baseScale = 1;
		let scale = 1;
		let tx = 0;
		let ty = 0;
		let dragging = false;
		let dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

		function bounds(effScale) {
			const dW = naturalWidth * effScale;
			const dH = naturalHeight * effScale;
			return { minX: Math.min(0, VIEWPORT - dW), minY: Math.min(0, VIEWPORT - dH) };
		}

		function clampPos(effScale, x, y) {
			const { minX, minY } = bounds(effScale);
			return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
		}

		function applyTransform() {
			img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
		}

		function setZoom(zoomValue) {
			const newScale = baseScale * zoomValue;
			const cx = VIEWPORT / 2;
			const cy = VIEWPORT / 2;
			const imgX = (cx - tx) / scale;
			const imgY = (cy - ty) / scale;
			const clamped = clampPos(newScale, cx - imgX * newScale, cy - imgY * newScale);
			scale = newScale;
			tx = clamped.x;
			ty = clamped.y;
			applyTransform();
		}

		img.onload = () => {
			naturalWidth = img.naturalWidth;
			naturalHeight = img.naturalHeight;
			baseScale = Math.max(VIEWPORT / naturalWidth, VIEWPORT / naturalHeight);
			scale = baseScale;
			img.style.width = `${naturalWidth}px`;
			img.style.height = `${naturalHeight}px`;
			img.style.transformOrigin = '0 0';
			tx = (VIEWPORT - naturalWidth * scale) / 2;
			ty = (VIEWPORT - naturalHeight * scale) / 2;
			applyTransform();
		};

		viewport.addEventListener('pointerdown', (e) => {
			dragging = true;
			viewport.setPointerCapture(e.pointerId);
			dragStart = { x: e.clientX, y: e.clientY, tx, ty };
			viewport.style.cursor = 'grabbing';
		});
		viewport.addEventListener('pointermove', (e) => {
			if (!dragging) return;
			const dx = e.clientX - dragStart.x;
			const dy = e.clientY - dragStart.y;
			const clamped = clampPos(scale, dragStart.tx + dx, dragStart.ty + dy);
			tx = clamped.x;
			ty = clamped.y;
			applyTransform();
		});
		function endDrag() {
			dragging = false;
			viewport.style.cursor = 'grab';
		}
		viewport.addEventListener('pointerup', endDrag);
		viewport.addEventListener('pointercancel', endDrag);

		zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)));

		function cleanup() {
			URL.revokeObjectURL(objectUrl);
			overlay.remove();
		}

		overlay.querySelector('#crop-cancel').addEventListener('click', () => {
			cleanup();
			resolve(null);
		});
		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) {
				cleanup();
				resolve(null);
			}
		});
		overlay.querySelector('#crop-save').addEventListener('click', () => {
			const canvas = document.createElement('canvas');
			canvas.width = OUTPUT_SIZE;
			canvas.height = OUTPUT_SIZE;
			const ctx = canvas.getContext('2d');
			const sourceSize = VIEWPORT / scale;
			const sourceX = Math.max(0, Math.min(-tx / scale, naturalWidth - sourceSize));
			const sourceY = Math.max(0, Math.min(-ty / scale, naturalHeight - sourceSize));
			ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
			canvas.toBlob((blob) => {
				cleanup();
				resolve(blob);
			}, 'image/jpeg', 0.92);
		});
	});
}
