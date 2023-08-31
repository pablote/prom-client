'use strict';
const { globalRegistry } = require('./registry');

class Pushgateway {
	constructor(gatewayUrl, options, registry, { overridePath } = {}) {
		if (!registry) {
			registry = globalRegistry;
		}
		this.registry = registry;
		this.gatewayUrl = gatewayUrl;
		this.requestOptions = Object.assign({}, options);
		this.overridePath = overridePath;
	}

	pushAdd(params) {
		if (!params || !params.jobName) {
			throw new Error('Missing jobName parameter');
		}

		return useGateway.call(this, 'POST', params.jobName, params.groupings);
	}

	push(params) {
		if (!params || !params.jobName) {
			throw new Error('Missing jobName parameter');
		}

		return useGateway.call(this, 'PUT', params.jobName, params.groupings);
	}

	delete(params) {
		if (!params || !params.jobName) {
			throw new Error('Missing jobName parameter');
		}

		return useGateway.call(this, 'DELETE', params.jobName, params.groupings);
	}
}

async function useGateway(method, job, groupings) {
	const gatewayUrlParsed = new URL(this.gatewayUrl);
	const gatewayUrlPath =
		gatewayUrlParsed.pathname && gatewayUrlParsed.pathname !== '/'
			? gatewayUrlParsed.pathname
			: '';
	let path = `${gatewayUrlPath}/metrics/job/${encodeURIComponent(
		job,
	)}${generateGroupings(groupings)}`;

	if (this.overridePath) {
		path = this.overridePath;
	}

	const target = resolve(this.gatewayUrl, path);
	const options = {
		...this.requestOptions,
		...{ method },
	};

	if (method === 'DELETE' && options.headers) {
		delete options.headers['Content-Encoding'];
	}

	if (method !== 'DELETE') {
		options.body = await this.registry.metrics();
	}

	const response = await fetch(target, options);
	return { resp: response, body: response.body };
}

function generateGroupings(groupings) {
	if (!groupings) {
		return '';
	}
	return Object.keys(groupings)
		.map(
			key =>
				`/${encodeURIComponent(key)}/${encodeURIComponent(groupings[key])}`,
		)
		.join('');
}

function resolve(from, to) {
	const resolvedUrl = new URL(to, new URL(from, 'resolve://'));
	if (resolvedUrl.protocol === 'resolve:') {
		// `from` is a relative URL.
		const { pathname, search, hash } = resolvedUrl;
		return pathname + search + hash;
	}
	return resolvedUrl.toString();
}

module.exports = Pushgateway;
