FROM node:10.15.3

ARG PORT=3039
ENV PORT=${PORT}

ARG CONFIG_NET=production
ENV CONFIG_NET=${CONFIG_NET}

WORKDIR /home/eosweb

RUN npm install -g pm2@3.5.1
RUN npm install -g @angular/cli@7.1.4
COPY package.json /home/eosweb/package.json
COPY package-lock.json /home/eosweb/package-lock.json
RUN cd /home/eosweb && npm install
COPY server/package.json /home/eosweb/server/package.json
COPY server/package-lock.json /home/eosweb/server/package-lock.json
RUN cd /home/eosweb/server && npm install

COPY . /home/eosweb
RUN cd /home/eosweb && node patch
RUN cd /home/eosweb && ng build --configuration=${CONFIG_NET}
CMD ["pm2-runtime", "/home/eosweb/server/ecosystem.config.js", "--web"]

EXPOSE ${PORT}
EXPOSE 9615
