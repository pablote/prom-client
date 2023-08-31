'use strict';
const fetchMock = require('jest-fetch-mock');
const Registry = require('../index').Registry;

const pushGatewayURL = 'http://192.168.99.100:9091';

fetchMock.enableMocks();

describe.each([
	['Prometheus', Registry.PROMETHEUS_CONTENT_TYPE],
	['OpenMetrics', Registry.OPENMETRICS_CONTENT_TYPE],
])('pushgateway with %s registry', (tag, regType) => {
	const Pushgateway = require('../index').Pushgateway;
	const register = require('../index').register;
	let instance;
	let registry = undefined;

	beforeEach(() => {
		register.setContentType(regType);
	});

	const tests = function () {
		let body;
		if (regType === Registry.OPENMETRICS_CONTENT_TYPE) {
			body = '# HELP test test\n# TYPE test counter\ntest_total 100\n# EOF\n';
		} else {
			body = '# HELP test test\n# TYPE test counter\ntest 100\n';
		}

		describe('pushAdd', () => {
			it('should push metrics', async () => {
				await instance.pushAdd({ jobName: 'testJob' });
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toEqual(
					`${pushGatewayURL}/metrics/job/testJob`,
				);
			});

			it('should use groupings', async () => {
				await instance.pushAdd({
					jobName: 'testJob',
					groupings: { key: 'value' },
				});
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toEqual(
					`${pushGatewayURL}/metrics/job/testJob/key/value`,
				);
			});

			it('should escape groupings', async () => {
				await instance.pushAdd({
					jobName: 'testJob',
					groupings: { key: 'va&lue' },
				});
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toEqual(
					`${pushGatewayURL}/metrics/job/testJob/key/va%26lue`,
				);
			});
		});

		describe('push', () => {
			it('should push with PUT', async () => {
				await instance.push({ jobName: 'testJob' });
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toEqual(
					`${pushGatewayURL}/metrics/job/testJob`,
				);
			});

			it('should uri encode url', async () => {
				await instance.push({ jobName: 'test&Job' });
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toEqual(
					`${pushGatewayURL}/metrics/job/test%26Job`,
				);
			});
		});

		describe('delete', () => {
			it('should push delete with no body', async () => {
				await instance.delete({ jobName: 'testJob' });
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toEqual(
					`${pushGatewayURL}/metrics/job/testJob`,
				);
			});
		});

		describe('when using basic authentication', () => {
			const USERNAME = 'unittest';
			const PASSWORD = 'unittest';
			const auth = `${USERNAME}:${PASSWORD}`;

			beforeEach(() => {
				instance = new Pushgateway(
					`http://${auth}@192.168.99.100:9091`,
					null,
					registry,
				);
			});

			it('pushAdd should send POST request with basic auth data', async () => {
				await instance.pushAdd({ jobName: 'testJob' });
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toContain(auth);
			});

			it('push should send PUT request with basic auth data', async () => {
				await instance.push({ jobName: 'testJob' });
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toContain(auth);
			});

			it('delete should send DELETE request with basic auth data', async () => {
				await instance.delete({ jobName: 'testJob' });
				expect(fetchMock).toHaveBeenCalled();
				expect(fetchMock.mock.lastCall[0]).toContain(auth);
			});
		});

		it('should be possible to extend http/s requests with options', async () => {
			instance = new Pushgateway(
				'http://192.168.99.100:9091',
				{
					headers: {
						'unit-test': '1',
					},
				},
				registry,
			);

			await instance.push({ jobName: 'testJob' });
			expect(fetchMock).toHaveBeenCalled();
			expect(fetchMock.mock.lastCall[1].headers).toEqual({ 'unit-test': '1' });
		});
	};

	describe('global registry', () => {
		afterEach(() => {
			register.clear();
			fetchMock.resetMocks();
		});

		beforeEach(() => {
			registry = undefined;
			instance = new Pushgateway('http://192.168.99.100:9091');
			const promClient = require('../index');
			const cnt = new promClient.Counter({ name: 'test', help: 'test' });
			cnt.inc(100);
		});

		tests();
	});

	describe('registry instance', () => {
		afterEach(() => {
			register.clear();
			fetchMock.resetMocks();
		});

		beforeEach(() => {
			registry = new Registry(regType);
			instance = new Pushgateway('http://192.168.99.100:9091', null, registry);
			const promeClient = require('../index');
			const cnt = new promeClient.Counter({
				name: 'test',
				help: 'test',
				registers: [registry],
			});
			cnt.inc(100);
		});

		tests();
	});
});
