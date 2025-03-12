declare namespace JSX {
	interface IntrinsicElements {
		[elemName: string]: any;
	}
	function render(element: any): string;
}
