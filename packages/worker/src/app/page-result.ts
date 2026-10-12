import { type AppLoaderData } from '#universal/loader-data.ts'

/** Result of a page operation, independent of the HTML renderer. */
export type AppPageResult = {
	title?: string
	status?: number
	loaderData?: AppLoaderData
	extraSetCookies?: Array<string>
}
