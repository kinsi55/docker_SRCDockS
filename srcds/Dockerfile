FROM debian:buster-slim as ENTRYPOINT

RUN apt-get update \
		&& apt-get install -y \
			build-essential

COPY ./srcds/main.cpp ./
RUN gcc -o main main.cpp


FROM debian:buster-slim

ENV APP_NAME=csgo
ENV SRCDS_ARGS=""
ENV NO_BSP_CVAR=0
ENV SRCDS_RUN=0
ENV IP=0.0.0.0
ENV PORT=27015
ENV STOCK_SM_PLUGINS=""

VOLUME [ "/repo" ]

RUN apt-get update \
		&& apt-get install -y --no-install-recommends --no-install-suggests \
			lib32gcc1 \
			lib32stdc++6 \
			lib32z1 \
#			procps \
			ca-certificates \
			netcat \
			curl

# Cleanup
RUN rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /srcds

COPY ./srcds/*.sh ./
COPY --from=ENTRYPOINT main ./

RUN useradd -m srcds && mkdir srv && chown srcds srv && chmod +x *.sh

USER srcds

# Not creating this folder will cause various error messages to be logged on the first start.
RUN mkdir -p ~/Steam ~/.steam/sdk32/

EXPOSE 27015/tcp 27015/udp

#ENTRYPOINT [ "bash", "/srcds/main.sh" ]
ENTRYPOINT [ "/srcds/main" ]

#HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 CMD [ "test -n \"$(echo -ne '\xff\xff\xff\xffTSource Engine Query\0' | nc -u -w 1 $(hostname) 27015)\"" ]
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 CMD [ "/srcds/healthcheck.sh" ]