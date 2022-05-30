import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import Head from "next/head"
import React, { useEffect } from "react"
import styles from "../styles/Home.module.css"

import { useFormik } from 'formik';
import * as yup from 'yup';
import TextField from '@mui/material/TextField';


import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Contract, providers } from "ethers"

import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import { Button } from "@mui/material"

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

function hex_to_ascii(str1: String) {
    var hex = str1.toString();
    var str = '';
    for (var n = 0; n < hex.length; n += 2) {
        if (parseInt(hex.substr(n, 2), 16) >= 32) {
            str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        }
    }
    return str;
}

const validationSchema = yup.object({
    name: yup
        .string()
        .matches(/^[A-Za-z ]*$/, 'Please enter valid name')
        .min(5)
        .max(40),

    address: yup
        .string()
        .min(5)
        .max(40),

    age: yup
        .number()
        .min(10, "You must be greater than ten years old")
        .max(100, "You must be less than 100 years old")
});


export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [greeting, setGreeting] = React.useState('Greetings')

    useEffect(() => {
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi, provider)

        contract.on("NewGreeting", (e) => {
            console.log("NewGreeting Event: ");
            console.log(`Greetings from ${hex_to_ascii(e)}`)
            setGreeting(`Greetings from ${hex_to_ascii(e)}`)
        })

        console.log("Initiating Listener");


    }, [])

    const formik = useFormik({
        initialValues: {
            name: '',
            address: '',
            age: '',
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {
            alert(JSON.stringify(values, null, 2));
        },
    });


    async function greet(msg:string) {
        console.log(msg)
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = msg
        console.log(msg)

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <ThemeProvider theme={darkTheme}>

            <div className={styles.container}>
                <Head>
                    <title>Greetings</title>
                    <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                    <link rel="icon" href="/favicon.ico" />
                </Head>

                <main className={styles.main}>
                    <h1 className={styles.title}>{greeting}</h1>

                    <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                    <div className={styles.logs}>{logs}</div>

                    <div>
                        <form onSubmit={formik.handleSubmit}>

                            <TextField
                                fullWidth
                                id="name"
                                name="name"
                                label="Name"
                                value={formik.values.name}
                                onChange={formik.handleChange}
                                error={formik.touched.name && Boolean(formik.errors.name)}
                                helperText={formik.touched.name && formik.errors.name}
                                required
                            />
                            <TextField
                                fullWidth
                                id="address"
                                name="address"
                                label="Address"
                                value={formik.values.address}
                                onChange={formik.handleChange}
                                error={formik.touched.address && Boolean(formik.errors.address)}
                                helperText={formik.touched.address && formik.errors.address}
                                required
                            />
                            <TextField
                                fullWidth
                                id="age"
                                name="age"
                                label="Age"
                                type="number"
                                value={formik.values.age}
                                onChange={formik.handleChange}
                                error={formik.touched.age && Boolean(formik.errors.age)}
                                helperText={formik.touched.age && formik.errors.age}
                                required
                            />
                            <Button color="primary" variant="contained" fullWidth type="submit">
                                Submit
                            </Button>

                            <div onClick={() =>  greet(formik.values.address) } className={styles.button}>
                                Greet
                            </div>
                        </form>
                    </div>

                </main>
            </div>
        </ThemeProvider>
    )
}
