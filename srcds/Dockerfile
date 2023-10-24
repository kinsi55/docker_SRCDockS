FROM debian:bullseye-slim as entrypoint

RUN apt-get update \
		&& apt-get install -y \
			build-essential

COPY ./srcds/main.cpp ./
RUN gcc -o main main.cpp


FROM debian:bullseye-slim

ENV APP_NAME=csgo
ENV SRCDS_ARGS=""
ENV NO_BSP_CVAR=0
ENV SRCDS_RUN=0
ENV IP=0.0.0.0
ENV PORT=27015
ENV STOCK_SM_PLUGINS=""

VOLUME [ "/repo" ]

ARG UID=1000
ARG apt_install_packages
ARG run_before_apt

RUN $run_before_apt

RUN apt-get update \
		&& apt-get install -y --no-install-recommends --no-install-suggests \
#			lib32gcc1 \
			lib32stdc++6 \
			lib32z1 \
#			procps \
			ca-certificates \
			netcat \
			curl \
			$apt_install_packages

RUN mkdir /overlays

# Cleanup
RUN rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /srcds

COPY ./srcds/*.sh ./
COPY --from=entrypoint main ./

RUN useradd -m -u $UID srcds && mkdir srv && chown srcds srv && chmod +x *.sh

USER srcds

# Not creating this folder will cause various error messages to be logged on the first start.
RUN mkdir -p ~/Steam ~/.steam/sdk32/

EXPOSE 27015/tcp 27015/udp

ENTRYPOINT [ "/srcds/main" ]

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=2 CMD [ "/srcds/healthcheck.sh" ]
