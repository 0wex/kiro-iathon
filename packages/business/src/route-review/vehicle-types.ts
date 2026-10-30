export const VEHICLE_TYPE_IDS = [
	"pickup",
	"c2",
	"c3",
	"b3",
	"t2s3",
	"t3s3",
	"other",
] as const;
export type VehicleTypeId = (typeof VEHICLE_TYPE_IDS)[number];

export interface VehicleType {
	mtcCode: string | null;
	axleCount: number | null;
	grossWeightKg: number | null;
}

export const VEHICLE_TYPES: Record<VehicleTypeId, VehicleType> = {
	pickup: { mtcCode: null, axleCount: 2, grossWeightKg: 3_000 },
	c2: { mtcCode: "C2", axleCount: 2, grossWeightKg: 12_000 },
	c3: { mtcCode: "C3", axleCount: 3, grossWeightKg: 25_000 },
	b3: { mtcCode: "B3", axleCount: 3, grossWeightKg: 18_000 },
	t2s3: { mtcCode: "T2S3", axleCount: 5, grossWeightKg: 43_000 },
	t3s3: { mtcCode: "T3S3", axleCount: 6, grossWeightKg: 48_000 },
	other: { mtcCode: null, axleCount: null, grossWeightKg: null },
};
