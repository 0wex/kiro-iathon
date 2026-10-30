declare module "*.css";

declare module "*?worker&url" {
	const workerUrl: string;
	export default workerUrl;
}
