import {
	PHOTO_MAX_BYTES,
	PHOTO_MEDIA_TYPES,
	type ReportPhoto,
} from "@iathon-kiro/business/citizen-reports/index";

import {
	BYTES_PER_KILOBYTE,
	CITIZEN_REPORT_PHOTO_JPEG_QUALITIES,
	CITIZEN_REPORT_PHOTO_MAX_SIDES_PX,
} from "@/constants";
import { m } from "@/paraglide/messages";

const BASE64_BYTES_PER_CHAR = 3 / 4;

export interface CompressedPhoto {
	photo: ReportPhoto;
	previewUrl: string;
}

export async function compressPhotoToJpeg(
	file: File,
): Promise<CompressedPhoto> {
	if (!PHOTO_MEDIA_TYPES.some((mediaType) => mediaType === file.type))
		throw new Error(m.citizen_reports_form_photo_invalid_type());
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context) throw new Error(m.citizen_reports_form_photo_read_error());
	const bitmap = await createImageBitmap(file).catch(() => {
		throw new Error(m.citizen_reports_form_photo_read_error());
	});
	try {
		for (const maxSidePx of CITIZEN_REPORT_PHOTO_MAX_SIDES_PX) {
			const scale = Math.min(
				1,
				maxSidePx / Math.max(bitmap.width, bitmap.height),
			);
			canvas.width = Math.round(bitmap.width * scale);
			canvas.height = Math.round(bitmap.height * scale);
			context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			for (const quality of CITIZEN_REPORT_PHOTO_JPEG_QUALITIES) {
				const dataUrl = canvas.toDataURL("image/jpeg", quality);
				const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
				if (Math.floor(base64.length * BASE64_BYTES_PER_CHAR) <= PHOTO_MAX_BYTES)
					return {
						photo: { mediaType: "image/jpeg", base64 },
						previewUrl: dataUrl,
					};
			}
		}
	} finally {
		bitmap.close();
	}
	throw new Error(
		m.citizen_reports_form_photo_too_large({
			maxKilobytes: String(PHOTO_MAX_BYTES / BYTES_PER_KILOBYTE),
		}),
	);
}
