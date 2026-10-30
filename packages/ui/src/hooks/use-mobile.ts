import { useEffect, useState } from "react";

import { MOBILE_BREAKPOINT_PX } from "../constants";

export function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia(`(width < ${MOBILE_BREAKPOINT_PX}px)`);
		const onChange = () => setIsMobile(mediaQuery.matches);
		mediaQuery.addEventListener("change", onChange);
		onChange();
		return () => mediaQuery.removeEventListener("change", onChange);
	}, []);

	return isMobile;
}
