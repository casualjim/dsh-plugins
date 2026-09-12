/** The client bundler loads `*.css` as text (`loader: { '.css': 'text' }`), so the entry inlines it. */
declare module '*.css' {
	const css: string
	export default css
}
