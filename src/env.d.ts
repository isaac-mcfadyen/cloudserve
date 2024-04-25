declare module "*.txt.js" {
	const content: string;
	export default content;
}

declare type URLPattern = {
	test: (input: string) => boolean;
};

declare var FILE_LIST: {
	pattern: URLPattern;
	content: any;
}[];
