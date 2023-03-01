FROM node:18

ARG wf_version=1.0.0

LABEL \
    com.wayfair.app="wayfair-incubator/gqmock" \
    com.wayfair.description="GraphQL Mocking Service" \
    com.wayfair.maintainer="Michal Mazur <michal.mazur221@gmail.com>" \
    com.wayfair.vendor="Wayfair LLC." \
    com.wayfair.version=${wf_version}

COPY . .

RUN yarn install
RUN yarn build

CMD ["node", "dockerEntrypoint.js"]