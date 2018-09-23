#!/bin/sh

DOMAIN=nodestack.local
# KEYSIZE=2048
KEYSIZE=1024

if ! (which openssl > /dev/null); then
    echo "openssl is required"
    exit 1
fi

rm -rf tls/*

# create ca key and cert
mkdir -p tls/ca
cat > tls/ca/ext.conf <<CA_CNF
basicConstraints=CA:FALSE
subjectAltName=@my_subject_alt_names
subjectKeyIdentifier = hash

[ my_subject_alt_names ]
DNS.1 = localhost
DNS.2 = *.nodestack.local
CA_CNF

openssl genrsa -out tls/ca/root.key $KEYSIZE
openssl req -new -x509 -key tls/ca/root.key -out tls/ca/root.crt -subj "/C=SG/ST=Singapore/L=Singapore/O=Nodestack/CN=ca.$DOMAIN"

# create certs for nginx
mkdir -p tls/nginx
openssl genrsa -out tls/nginx/server.key $KEYSIZE
chmod 400 tls/nginx/server.key
openssl req -new -key tls/nginx/server.key -out tls/nginx/server.csr -subj "/C=SG/ST=Singapore/L=Singapore/O=Nodestack/CN=lb.$DOMAIN"
openssl x509 -req -in tls/nginx/server.csr -CA tls/ca/root.crt -CAkey tls/ca/root.key -CAcreateserial -extfile tls/ca/ext.conf -out tls/nginx/server.crt
cp tls/ca/root.crt tls/nginx/ca.crt

# create certs for nodejs app
mkdir -p tls/node
openssl genrsa -out tls/node/node.key $KEYSIZE
chmod 400 tls/node/node.key
openssl req -new -key tls/node/node.key -out tls/node/node.csr -subj "/C=SG/ST=Singapore/L=Singapore/O=Nodestack/CN=node.$DOMAIN"
openssl x509 -req -in tls/node/node.csr -CA tls/ca/root.crt -CAkey tls/ca/root.key -CAcreateserial -extfile tls/ca/ext.conf -out tls/node/node.crt
cp tls/ca/root.crt tls/node/ca.crt
