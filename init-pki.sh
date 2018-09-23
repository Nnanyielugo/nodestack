#!/bin/sh

DOMAIN=nodestack.local
# KEYSIZE=2048
KEYSIZE=1024 # for testing, faster but insecure

if ! (which openssl > /dev/null); then
    echo "openssl is required"
    exit 1
fi

# create ca key and cert
rm -rf pki/ca
mkdir -p pki/ca
cat > pki/ca/ext.conf <<CA_CNF
basicConstraints=CA:FALSE
subjectAltName=@my_subject_alt_names
subjectKeyIdentifier = hash

[ my_subject_alt_names ]
DNS.1 = localhost
DNS.2 = *.nodestack.local
CA_CNF

openssl genrsa -out pki/ca/root.key $KEYSIZE
openssl req -new -x509 -key pki/ca/root.key -out pki/ca/root.crt -subj "/CN=ca.$DOMAIN"

NAMES='nginx node postgres'

for NAME in $NAMES; do
    rm -rf pki/$NAME
    mkdir -p pki/$NAME
    openssl genrsa -out pki/$NAME/$NAME.key $KEYSIZE
    chmod 400 pki/$NAME/$NAME.key
    openssl req -new -key pki/$NAME/$NAME.key -out pki/$NAME/$NAME.csr -subj "/CN=$NAME.$DOMAIN"
    openssl x509 -req -in pki/$NAME/$NAME.csr -CA pki/ca/root.crt -CAkey pki/ca/root.key -CAcreateserial -extfile pki/ca/ext.conf -out pki/$NAME/$NAME.crt
    cp pki/ca/root.crt pki/$NAME/ca.crt
done

# Like before, but generates certs using a different CA to provide to test connecting to postgres using 
# mismatching certificates.

DOMAIN=bogus.local
NAME=postgres

rm -rf pki/bogus*
mkdir -p pki/bogus
mkdir -p pki/bogus-ca

openssl genrsa -out pki/bogus-ca/root.key $KEYSIZE
openssl req -new -x509 -key pki/bogus-ca/root.key -out pki/bogus-ca/root.crt -subj "/CN=ca.$DOMAIN"

openssl genrsa -out pki/bogus/$NAME.key $KEYSIZE
chmod 600 pki/bogus/$NAME.key
openssl req -new -key pki/bogus/$NAME.key -out pki/bogus/$NAME.csr -subj "/CN=$NAME.$DOMAIN"
openssl x509 -req -in pki/bogus/$NAME.csr -CA pki/bogus-ca/root.crt -CAkey pki/bogus-ca/root.key -CAcreateserial -out pki/bogus/$NAME.crt
cp pki/bogus-ca/root.crt pki/bogus/ca.crt
