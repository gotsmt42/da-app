import { Card, CardBody, CardTitle, CardSubtitle, Table } from "reactstrap";
import user1 from "../../assets/images/users/user1.jpg";
import user2 from "../../assets/images/users/user2.jpg";
import user3 from "../../assets/images/users/user3.jpg";
import user4 from "../../assets/images/users/user4.jpg";
import user5 from "../../assets/images/users/user5.jpg";
import AuthService from "../../services/authService";
import { useEffect, useState } from "react";
import API from "../../API/axiosInstance";

import moment from "moment";

const tableData = [
  {
    avatar: user1,
    name: "User Test 1",
    email: "usertest1@gmail.com",
    project: "HTML",
    status: "pending",
    weeks: "35",
    budget: "95K",
  },
  {
    avatar: user2,
    name: "User Test 2",
    email: "usertest2@gmail.com",
    project: "Java Script",
    status: "done",
    weeks: "35",
    budget: "95K",
  },
  {
    avatar: user3,
    name: "User Test 3",
    email: "usertest3@gmail.com",
    project: "Type Script",
    status: "holt",
    weeks: "35",
    budget: "95K",
  },
  {
    avatar: user4,
    name: "User Test 4",
    email: "usertest4@gmail.com",
    project: "Express",
    status: "pending",
    weeks: "35",
    budget: "95K",
  },
  {
    avatar: user5,
    name: "User Test 5",
    email: "usertest5@gmail.com",
    project: "React",
    status: "done",
    weeks: "35",
    budget: "95K",
  },
];

const ProjectTables = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const getAllUser = await AuthService.getAllUserData();
        setUsers(getAllUser.allUser);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    }

    fetchData();
  }, []);

  // Function to format salary as currency
  const formatCurrency = (amount) => {
    // Check if amount is valid and numeric
    if (!amount || isNaN(amount)) {
      return ""; // Return empty string if amount is invalid
    }

    // Use Intl.NumberFormat to format amount as currency
    const formatter = new Intl.NumberFormat("en-TH", {
      style: "currency",
      currency: "THB", // Change currency code as needed
      minimumFractionDigits: 2, // Minimum number of fractional digits
    });

    return formatter.format(amount); // Format amount as currency string
  };

  return (
    <div>
      <Card>
        <CardBody>
          <CardTitle tag="h5">Listing Employee</CardTitle>
          <CardSubtitle className="mb-2 text-muted" tag="h6">
            Overview
          </CardSubtitle>

          <Table className="no-wrap mt-3 align-middle" responsive borderless>
            <thead>
              <tr>
                <th>Team</th>
                <th>Rank</th>

                <th>Status</th>
                <th>Weeks</th>
                <th>Salary</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={index} className="border-top">
                  <td>
                    <div className="d-flex align-items-center p-2">
                      <img
                        src={user1}
                        // src={`${API.defaults.baseURL}/${user.imageUrl}`}
                        className="rounded-circle"
                        alt="avatar"
                        width="45"
                        height="45"
                      />
                      <div className="ms-3">
                        <h6 className="mb-0">{user.fname} {user.lname}</h6>
                        <span className="text-muted">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>{user.rank}</td>
                  <td>
                    {user.status === "offline" ? (
                      <span className="p-2 bg-danger rounded-circle d-inline-block ms-3"></span>
                    ) : user.status === "online" ? (
                      <span className="p-2 bg-success rounded-circle d-inline-block ms-3"></span>
                    ) : null}
                  </td>
                  <td>
                    {/* Calculate weeks since creation */}
                    {moment().diff(moment(user.createdAt), "weeks")}
                  </td>
                  <td>
                    {user.salary &&
                    typeof user.salary === "object" &&
                    user.salary.$numberDecimal ? (
                      <span>
                        {formatCurrency(parseFloat(user.salary.$numberDecimal))}
                      </span>
                    ) : (
                      <span>{formatCurrency(user.salary)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
};

export default ProjectTables;
